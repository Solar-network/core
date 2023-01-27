import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import {
    IrrevocableResignationError,
    NotEnoughTimeSinceResignationError,
    WalletAlreadyPermanentlyResignedError,
    WalletAlreadyTemporarilyResignedError,
    WalletNotABlockProducerError,
    WalletNotResignedError,
} from "../errors";
import { RegistrationTransactionHandler } from "./registration";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class ResignationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [RegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["blockProducer.resignation", "blockProducer.resignation.height", "blockProducer.resignation.type"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.ResignationTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
            }

            let type: Enums.BlockProducerStatus = Enums.BlockProducerStatus.TemporaryResign;
            if (transaction.asset && transaction.asset.resignation && transaction.asset.resignation.type) {
                type = transaction.asset.resignation.type;
            }

            if (type !== Enums.BlockProducerStatus.NotResigned) {
                wallet.setAttribute("blockProducer.resignation.height", transaction.blockHeight);
                wallet.setAttribute("blockProducer.resignation.type", type);
            } else {
                wallet.forgetAttribute("blockProducer.resignation");
            }

            this.walletRepository.index(wallet);
        }
    }
    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        return true;
    }

    public fee(context: Contracts.Shared.FeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        if (!wallet.isBlockProducer()) {
            throw new WalletNotABlockProducerError();
        }

        let type: Enums.BlockProducerStatus = Enums.BlockProducerStatus.TemporaryResign;
        if (transaction.data.asset && transaction.data.asset.resignation && transaction.data.asset.resignation.type) {
            type = transaction.data.asset.resignation.type;
        }

        if (wallet.hasAttribute("blockProducer.resignation.type")) {
            if (wallet.getAttribute("blockProducer.resignation.type") === Enums.BlockProducerStatus.PermanentResign) {
                if (type === Enums.BlockProducerStatus.PermanentResign) {
                    throw new WalletAlreadyPermanentlyResignedError();
                }

                throw new IrrevocableResignationError();
            } else if (type === Enums.BlockProducerStatus.TemporaryResign) {
                throw new WalletAlreadyTemporarilyResignedError();
            } else if (type === Enums.BlockProducerStatus.NotResigned) {
                const lastBlock: Interfaces.IBlock = this.app
                    .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                    .getLastBlock();

                const { blocksToRevokeResignation } = Managers.configManager.getMilestone();
                const resignationHeight = wallet.getAttribute("blockProducer.resignation.height");
                if (lastBlock.data.height - resignationHeight < blocksToRevokeResignation) {
                    throw new NotEnoughTimeSinceResignationError(
                        resignationHeight - lastBlock.data.height + blocksToRevokeResignation,
                    );
                }
            }
        } else if (type === Enums.BlockProducerStatus.NotResigned) {
            throw new WalletNotResignedError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction): void {
        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const username = senderWallet.getAttribute("username");

        this.events.dispatch(AppEnums.BlockProducerEvent.Resigned, {
            ...transaction.data,
            username,
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderId)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);
            throw new Contracts.Pool.PoolError(
                `Resignation for '${wallet.getAttribute("username")}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        let type: Enums.BlockProducerStatus = Enums.BlockProducerStatus.TemporaryResign;
        if (transaction.data.asset && transaction.data.asset.resignation && transaction.data.asset.resignation.type) {
            type = transaction.data.asset.resignation.type;
        }

        if (type === Enums.BlockProducerStatus.NotResigned) {
            senderWallet.forgetAttribute("blockProducer.resignation");
        } else {
            senderWallet.setAttribute("blockProducer.resignation.height", transaction.data.blockHeight);
            senderWallet.setAttribute("blockProducer.resignation.type", type);
        }

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const previousResignation = await this.getPreviousResignation(transaction.data.blockHeight! - 1, transaction);
        let type = Enums.BlockProducerStatus.NotResigned;

        if (previousResignation) {
            AppUtils.assert.defined<string>(previousResignation.asset?.resignation);
            ({ type } = previousResignation.asset.resignation);
        }

        if (type === Enums.BlockProducerStatus.NotResigned) {
            senderWallet.forgetAttribute("blockProducer.resignation");
        } else {
            senderWallet.setAttribute("blockProducer.resignation.height", previousResignation.blockHeight);
            senderWallet.setAttribute("blockProducer.resignation.type", type);
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    private async getPreviousResignation(
        height: number,
        transaction: Interfaces.ITransaction,
    ): Promise<Interfaces.ITransactionData> {
        const { results } = await this.transactionHistoryService.listByCriteria(
            {
                blockHeight: { to: height },
                senderId: transaction.data.senderId,
                type: this.getConstructor().key,
            },
            [
                { property: "blockHeight", direction: "desc" },
                { property: "sequence", direction: "desc" },
            ],
            { offset: 0, limit: 1 },
            false,
        );

        return results[0];
    }
}

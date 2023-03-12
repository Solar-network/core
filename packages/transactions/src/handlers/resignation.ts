import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import {
    IrrevocableResignationError,
    NotEnoughBlockProducersError,
    NotEnoughTimeSinceResignationError,
    WalletAlreadyPermanentlyResignedError,
    WalletAlreadyTemporarilyResignedError,
    WalletNotABlockProducerError,
    WalletNotResignedError,
} from "../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";
import { UpgradeTransactionHandler } from "./upgrade";

@Container.injectable()
export class ResignationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [UpgradeTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["blockProducer.resignation", "hidden", "hidden.resignationHeight", "hidden.resignationRound"];
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
            this.performWalletInitialisation(transaction, wallet);

            let type: Enums.BlockProducerStatus = Enums.BlockProducerStatus.TemporaryResign;
            if (transaction.asset && transaction.asset.resignation && transaction.asset.resignation.type) {
                type = transaction.asset.resignation.type;
            }

            if (type === Enums.BlockProducerStatus.NotResigned) {
                wallet.forgetAttribute("blockProducer.resignation");
                wallet.forgetAttribute("hidden.resignationHeight");
            } else {
                wallet.setAttribute("blockProducer.resignation", type);
                wallet.setAttribute("hidden.resignationHeight", transaction.blockHeight);
            }

            const { round } = AppUtils.roundCalculator.calculateRound(transaction.blockHeight!);
            wallet.setAttribute("hidden.resignationRound", round);

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

        if (wallet.hasAttribute("blockProducer.resignation")) {
            if (wallet.getAttribute("blockProducer.resignation") === Enums.BlockProducerStatus.PermanentResign) {
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
                const resignationHeight = wallet.getAttribute("hidden.resignationHeight");
                if (lastBlock.data.height - resignationHeight < blocksToRevokeResignation) {
                    throw new NotEnoughTimeSinceResignationError(
                        resignationHeight - lastBlock.data.height + blocksToRevokeResignation,
                    );
                }
            }
        } else if (type === Enums.BlockProducerStatus.NotResigned) {
            throw new WalletNotResignedError();
        }

        const requiredBlockProducersCount: number = Managers.configManager.getMilestone().activeBlockProducers;
        const currentBlockProducersCount: number = this.walletRepository
            .allBlockProducers()
            .filter((wallet: Contracts.State.Wallet) => !wallet.hasAttribute("blockProducer.resignation")).length;

        if (
            !wallet.hasAttribute("blockProducer.resignation") &&
            currentBlockProducersCount - 1 < requiredBlockProducersCount
        ) {
            throw new NotEnoughBlockProducersError();
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
            senderWallet.forgetAttribute("hidden.resignationHeight");
        } else {
            senderWallet.setAttribute("blockProducer.resignation", type);
            senderWallet.setAttribute("hidden.resignationHeight", transaction.data.blockHeight);
        }

        const { round } = AppUtils.roundCalculator.calculateRound(transaction.data.blockHeight!);
        senderWallet.setAttribute("hidden.resignationRound", round);

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const previousResignation = await this.getPreviousResignation(transaction);
        let type = Enums.BlockProducerStatus.NotResigned;

        if (previousResignation) {
            AppUtils.assert.defined<string>(previousResignation.asset?.resignation);
            ({ type } = previousResignation.asset.resignation);
            const { round } = AppUtils.roundCalculator.calculateRound(previousResignation.blockHeight!);
            senderWallet.setAttribute("hidden.resignationRound", round);
        } else {
            senderWallet.forgetAttribute("hidden.resignationRound");
        }

        if (type === Enums.BlockProducerStatus.NotResigned) {
            senderWallet.forgetAttribute("blockProducer.resignation");
            senderWallet.forgetAttribute("hidden.resignationHeight");
        } else {
            AppUtils.assert.defined<string>(previousResignation?.asset?.resignation);
            senderWallet.setAttribute("blockProducer.resignation", type);
            senderWallet.setAttribute("hidden.resignationHeight", previousResignation.blockHeight);
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    private async getPreviousResignation(
        transaction: Interfaces.ITransaction,
    ): Promise<Interfaces.ITransactionData | undefined> {
        return await this.transactionRepository.getPreviousSentTransactionOfType(transaction.data);
    }
}

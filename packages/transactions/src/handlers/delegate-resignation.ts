import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import {
    IrrevocableResignationError,
    NotEnoughDelegatesError,
    NotEnoughTimeSinceResignationError,
    WalletAlreadyPermanentlyResignedError,
    WalletAlreadyTemporarilyResignedError,
    WalletNotADelegateError,
    WalletNotResignedError,
} from "../errors";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class DelegateResignationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["delegate.resignation", "delegate.resignation.height", "delegate.resignation.type"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.DelegateResignationTransaction;
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

            let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
            if (transaction.asset && transaction.asset.resignation && transaction.asset.resignation.type) {
                type = transaction.asset.resignation.type;
            }

            if (type !== Enums.DelegateStatus.NotResigned) {
                wallet.setAttribute("delegate.resignation.height", transaction.blockHeight);
                wallet.setAttribute("delegate.resignation.type", type);
            } else {
                wallet.forgetAttribute("delegate.resignation");
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
        if (!wallet.isDelegate()) {
            throw new WalletNotADelegateError();
        }

        let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
        if (transaction.data.asset && transaction.data.asset.resignation && transaction.data.asset.resignation.type) {
            type = transaction.data.asset.resignation.type;
        }

        if (wallet.hasAttribute("delegate.resignation.type")) {
            if (wallet.getAttribute("delegate.resignation.type") === Enums.DelegateStatus.PermanentResign) {
                if (type === Enums.DelegateStatus.PermanentResign) {
                    throw new WalletAlreadyPermanentlyResignedError();
                }

                throw new IrrevocableResignationError();
            } else if (type === Enums.DelegateStatus.TemporaryResign) {
                throw new WalletAlreadyTemporarilyResignedError();
            } else if (type === Enums.DelegateStatus.NotResigned) {
                const lastBlock: Interfaces.IBlock = this.app
                    .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                    .getLastBlock();

                const { blocksToRevokeDelegateResignation } = Managers.configManager.getMilestone();
                const resignationHeight = wallet.getAttribute("delegate.resignation.height");
                if (lastBlock.data.height - resignationHeight < blocksToRevokeDelegateResignation) {
                    throw new NotEnoughTimeSinceResignationError(
                        resignationHeight - lastBlock.data.height + blocksToRevokeDelegateResignation,
                    );
                }
            }
        } else if (type === Enums.DelegateStatus.NotResigned) {
            throw new WalletNotResignedError();
        }

        const requiredDelegatesCount: number = Managers.configManager.getMilestone().activeDelegates;
        const currentDelegatesCount: number = this.walletRepository
            .allByUsername()
            .filter((w) => !w.hasAttribute("delegate.resignation")).length;

        if (!wallet.hasAttribute("delegate.resignation") && currentDelegatesCount - 1 < requiredDelegatesCount) {
            throw new NotEnoughDelegatesError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction): void {
        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const username = senderWallet.getAttribute("delegate.username");

        this.events.dispatch(AppEnums.DelegateEvent.Resigned, {
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
                `Delegate resignation for '${wallet.getAttribute("delegate.username")}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
        if (transaction.data.asset && transaction.data.asset.resignation && transaction.data.asset.resignation.type) {
            type = transaction.data.asset.resignation.type;
        }

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resignation");
        } else {
            senderWallet.setAttribute("delegate.resignation.height", transaction.data.blockHeight);
            senderWallet.setAttribute("delegate.resignation.type", type);
        }

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const previousResignation = await this.getPreviousResignation(transaction.data.blockHeight! - 1, transaction);
        let type = Enums.DelegateStatus.NotResigned;

        if (previousResignation) {
            AppUtils.assert.defined<string>(previousResignation.asset?.resignation);
            ({ type } = previousResignation.asset.resignation);
        }

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resignation");
        } else {
            senderWallet.setAttribute("delegate.resignation.height", previousResignation.blockHeight);
            senderWallet.setAttribute("delegate.resignation.type", type);
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

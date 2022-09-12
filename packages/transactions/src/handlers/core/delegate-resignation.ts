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
} from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

@Container.injectable()
export class DelegateResignationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["delegate.resigned"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.DelegateResignationTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
            }

            let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
            if (transaction.asset && transaction.asset.resignationType) {
                type = transaction.asset.resignationType;
            }

            if (type !== Enums.DelegateStatus.NotResigned) {
                wallet.setAttribute("delegate.resigned", type);
            } else {
                wallet.forgetAttribute("delegate.resigned");
            }

            this.walletRepository.index(wallet);
        }
    }
    public async isActivated(): Promise<boolean> {
        return true;
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
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
        if (transaction.data.asset && transaction.data.asset.resignationType) {
            type = transaction.data.asset.resignationType;
        }

        if (wallet.hasAttribute("delegate.resigned")) {
            if (wallet.getAttribute("delegate.resigned") === Enums.DelegateStatus.PermanentResign) {
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

                const { blockHeight } = await this.getPreviousResignation(lastBlock.data.height, transaction);
                AppUtils.assert.defined<string>(blockHeight);

                const { blocksToRevokeDelegateResignation } = Managers.configManager.getMilestone();
                if (lastBlock.data.height - blockHeight < blocksToRevokeDelegateResignation) {
                    throw new NotEnoughTimeSinceResignationError(
                        blockHeight - lastBlock.data.height + blocksToRevokeDelegateResignation,
                    );
                }
            }
        } else if (type === Enums.DelegateStatus.NotResigned) {
            throw new WalletNotResignedError();
        }

        const requiredDelegatesCount: number = Managers.configManager.getMilestone().activeDelegates;
        const currentDelegatesCount: number = this.walletRepository
            .allByUsername()
            .filter((w) => !w.hasAttribute("delegate.resigned")).length;

        if (!wallet.hasAttribute("delegate.resigned") && currentDelegatesCount - 1 < requiredDelegatesCount) {
            throw new NotEnoughDelegatesError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {
        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const username = senderWallet.getAttribute("delegate.username");

        emitter.dispatch(AppEnums.DelegateEvent.Resigned, {
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
        if (transaction.data.asset && transaction.data.asset.resignationType) {
            type = transaction.data.asset.resignationType;
        }

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resigned");
        } else {
            senderWallet.setAttribute("delegate.resigned", type);
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
            type = previousResignation.asset?.resignationType || Enums.DelegateStatus.TemporaryResign;
        }

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resigned");
        } else {
            senderWallet.setAttribute("delegate.resigned", type);
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
                typeGroup: this.getConstructor().typeGroup,
                type: this.getConstructor().type,
            },
            [{ property: "blockHeight", direction: "desc" }],
            { offset: 0, limit: 1 },
        );

        return results[0];
    }
}

import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/core-kernel";
import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";

import {
    NotEnoughDelegatesError,
    NotEnoughTimeSinceResignationError,
    ResignationTypeAssetMilestoneNotActiveError,
    WalletAlreadyPermanentlyResignedError,
    WalletAlreadyTemporarilyResignedError,
    WalletNotADelegateError,
    WalletNotResignedError,
} from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

@Container.injectable()
export class DelegateResignationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

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
            AppUtils.assert.defined<string>(transaction.senderPublicKey);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);

            let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
            if (transaction.asset && transaction.asset.resignationType) {
                type = transaction.asset.resignationType;
            }

            if (type !== Enums.DelegateStatus.NotResigned) {
                wallet.setAttribute("delegate.resigned", type);
            } else {
                wallet.forgetAttribute("delegate.resigned");
            }

            wallet.addStateHistory("delegateStatus", { height: transaction.blockHeight, type });
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

        const { delegateResignationTypeAsset } = Managers.configManager.getMilestone();

        if (!delegateResignationTypeAsset && type !== Enums.DelegateStatus.TemporaryResign) {
            throw new ResignationTypeAssetMilestoneNotActiveError();
        }

        if (wallet.hasAttribute("delegate.resigned")) {
            if (wallet.getAttribute("delegate.resigned") === Enums.DelegateStatus.PermanentResign) {
                throw new WalletAlreadyPermanentlyResignedError();
            } else if (type === Enums.DelegateStatus.TemporaryResign) {
                throw new WalletAlreadyTemporarilyResignedError();
            } else if (type === Enums.DelegateStatus.NotResigned) {
                const lastBlock: Interfaces.IBlock = this.app
                    .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                    .getLastBlock();

                const { height } = wallet.getLastStateHistory("delegateStatus");
                const { blocksToRevokeDelegateResignation } = Managers.configManager.getMilestone();
                if (lastBlock.data.height - height < blocksToRevokeDelegateResignation) {
                    throw new NotEnoughTimeSinceResignationError(
                        height - lastBlock.data.height + blocksToRevokeDelegateResignation,
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

        if (type !== Enums.DelegateStatus.NotResigned && currentDelegatesCount - 1 < requiredDelegatesCount) {
            throw new NotEnoughDelegatesError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {
        emitter.dispatch(AppEnums.DelegateEvent.Resigned, transaction.data);
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderPublicKey)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
                transaction.data.senderPublicKey,
            );
            throw new Contracts.TransactionPool.PoolError(
                `Delegate resignation for '${wallet.getAttribute("delegate.username")}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        let type: Enums.DelegateStatus = Enums.DelegateStatus.TemporaryResign;
        if (transaction.data.asset && transaction.data.asset.resignationType) {
            type = transaction.data.asset.resignationType;
        }

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resigned");
        } else {
            senderWallet.setAttribute("delegate.resigned", type);
        }

        senderWallet.addStateHistory("delegateStatus", { height: transaction.data.blockHeight, type });
        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        senderWallet.removeLastStateHistory("delegateStatus");
        const { type } = senderWallet.getLastStateHistory("delegateStatus");

        if (type === Enums.DelegateStatus.NotResigned) {
            senderWallet.forgetAttribute("delegate.resigned");
        } else {
            senderWallet.setAttribute("delegate.resigned", type);
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(
        transaction: Interfaces.ITransaction,
        // tslint:disable-next-line: no-empty
    ): Promise<void> {}

    public async revertForRecipient(
        transaction: Interfaces.ITransaction,
        // tslint:disable-next-line: no-empty
    ): Promise<void> {}
}

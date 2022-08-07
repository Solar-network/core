import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import assert from "assert";

import {
    HtlcLockNotExpiredByBlockHeightError,
    HtlcLockNotExpiredByEpochTimestampError,
    HtlcLockTransactionNotFoundError,
} from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { HtlcLockTransactionHandler } from "./htlc-lock";

@Container.injectable()
export class HtlcRefundTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [HtlcLockTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["htlc", "htlc.locks", "htlc.lockedBalance", "htlc.pendingBalance"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.HtlcRefundTransaction;
    }

    public async bootstrap(): Promise<void> {
        const balances = await this.transactionRepository.getRefundedHtlcLockBalances();

        for (const { senderPublicKey, refundedBalance } of balances) {
            // sender is from the original lock
            const refundWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(senderPublicKey);
            refundWallet.increaseBalance(Utils.BigNumber.make(refundedBalance));
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().htlcEnabled;
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        sender: Contracts.State.Wallet,
    ): Promise<void> {
        await this.performGenericWalletChecks(transaction, sender);

        // Specific HTLC refund checks
        AppUtils.assert.defined<string>(transaction.data.asset?.refund?.lockTransactionId);

        const lockId: string = transaction.data.asset.refund.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );
        if (!lockWallet || !lockWallet.getAttribute("htlc.locks")[lockId]) {
            throw new HtlcLockTransactionNotFoundError();
        }

        const lock: Interfaces.IHtlcLock = lockWallet.getAttribute("htlc.locks", {})[lockId];
        const lastBlock: Interfaces.IBlock = this.app
            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
            .getLastBlock();

        if (!AppUtils.expirationCalculator.calculateLockExpirationStatus(lastBlock, lock.expiration)) {
            if (lock.expiration.type === Enums.HtlcLockExpirationType.EpochTimestamp) {
                const { blockTime } = Managers.configManager.getMilestone();
                throw new HtlcLockNotExpiredByEpochTimestampError(
                    Math.ceil((lock.expiration.value - lastBlock.data.timestamp) / blockTime) * blockTime,
                );
            }

            throw new HtlcLockNotExpiredByBlockHeightError(lock.expiration.value - lastBlock.data.height);
        }
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.asset?.refund?.lockTransactionId);

        const lockId: string = transaction.data.asset.refund.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );

        if (!lockWallet || !lockWallet.getAttribute("htlc.locks")[lockId]) {
            throw new Contracts.Pool.PoolError(
                `The associated lock transaction id "${lockId}" was not found`,
                "ERR_HTLC_LOCK_NOT_FOUND",
            );
        }

        const hasRefund = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset?.refund?.lockTransactionId === lockId)
            .has();

        if (hasRefund) {
            throw new Contracts.Pool.PoolError(`HtlcRefund for '${lockId}' already in the pool`, "ERR_PENDING");
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const data: Interfaces.ITransactionData = transaction.data;

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        AppUtils.assert.defined<string>(data.asset?.refund?.lockTransactionId);

        const lockId: string = data.asset.refund.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );

        assert(lockWallet && lockWallet.getAttribute("htlc.locks", {})[lockId]);

        const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

        const recipientId: string | undefined = locks[lockId].recipientId;

        AppUtils.assert.defined<string>(recipientId);

        const newBalance: Utils.BigNumber = lockWallet.getBalance().plus(locks[lockId].amount);
        assert(!newBalance.isNegative());

        lockWallet.setBalance(newBalance);

        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance");
        const newLockedBalance: Utils.BigNumber = lockedBalance.minus(locks[lockId].amount);

        assert(!newLockedBalance.isNegative());

        const lockPendingBalance: Utils.BigNumber = lockWallet.getAttribute(
            "htlc.pendingBalance",
            Utils.BigNumber.ZERO,
        );

        if (newLockedBalance.isZero()) {
            lockWallet.forgetAttribute("htlc.lockedBalance");
            lockWallet.forgetAttribute("htlc.locks"); // zero lockedBalance means no pending locks
            if (lockPendingBalance.isZero()) {
                lockWallet.forgetAttribute("htlc");
            }
        } else {
            lockWallet.setAttribute("htlc.lockedBalance", newLockedBalance);
        }

        AppUtils.assert.defined<Interfaces.ITransactionData>(recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(recipientId);

        const pendingBalance: Utils.BigNumber = recipientWallet.getAttribute("htlc.pendingBalance");
        const newPendingBalance: Utils.BigNumber = pendingBalance.minus(locks[lockId].amount);

        assert(!newPendingBalance.isNegative());

        const recipientLockedBalance: Utils.BigNumber = recipientWallet.getAttribute(
            "htlc.lockedBalance",
            Utils.BigNumber.ZERO,
        );

        if (newPendingBalance.isZero()) {
            recipientWallet.forgetAttribute("htlc.pendingBalance");
            if (recipientLockedBalance.isZero()) {
                recipientWallet.forgetAttribute("htlc");
            }
        } else {
            recipientWallet.setAttribute("htlc.pendingBalance", newPendingBalance);
        }

        delete locks[lockId];

        this.walletRepository.index(lockWallet);
        this.walletRepository.index(recipientWallet);
        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        AppUtils.assert.defined<string>(transaction.data.asset?.refund?.lockTransactionId);

        const lockId: string = transaction.data.asset.refund.lockTransactionId;
        const lockTransaction: Interfaces.ITransactionData = (await this.transactionRepository.findByIds([lockId]))[0];

        AppUtils.assert.defined<string>(lockTransaction.id);
        AppUtils.assert.defined<string>(lockTransaction.senderPublicKey);
        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(lockTransaction.asset?.lock);

        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            lockTransaction.senderPublicKey,
        );

        lockWallet.decreaseBalance(lockTransaction.amount);

        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);
        lockWallet.setAttribute("htlc.lockedBalance", lockedBalance.plus(lockTransaction.amount));

        AppUtils.assert.defined<Interfaces.ITransactionData>(lockTransaction.recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            lockTransaction.recipientId,
        );

        const pendingBalance: Utils.BigNumber = recipientWallet.getAttribute(
            "htlc.pendingBalance",
            Utils.BigNumber.ZERO,
        );
        recipientWallet.setAttribute("htlc.pendingBalance", pendingBalance.plus(lockTransaction.amount));

        const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

        locks[lockTransaction.id] = {
            amount: lockTransaction.amount,
            recipientId: lockTransaction.recipientId,
            timestamp: lockTransaction.timestamp,
            memo: lockTransaction.memo ? Buffer.from(lockTransaction.memo, "hex").toString("utf8") : undefined,
            ...lockTransaction.asset.lock,
        };
        lockWallet.setAttribute("htlc.locks", locks);

        this.walletRepository.index(lockWallet);
        this.walletRepository.index(recipientWallet);
        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

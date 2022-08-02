import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { HtlcLockExpiredError, HtlcLockExpiresTooSoonError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class HtlcLockTransactionHandler extends TransactionHandler {
    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["htlc", "htlc.locks", "htlc.lockedBalance"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.HtlcLockTransaction;
    }

    public async bootstrap(): Promise<void> {
        const transactions = await this.transactionRepository.getOpenHtlcLocks();
        const walletsToIndex: Record<string, Contracts.State.Wallet> = {};
        for (const transaction of transactions) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
            const locks: Interfaces.IHtlcLocks = wallet.getAttribute("htlc.locks", {});

            let lockedBalance: Utils.BigNumber = wallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);

            locks[transaction.id] = {
                amount: Utils.BigNumber.make(transaction.amount),
                recipientId: transaction.recipientId,
                timestamp: transaction.timestamp,
                memo: transaction.memo ? Buffer.from(transaction.memo, "hex").toString("utf8") : undefined,
                ...transaction.asset.lock,
            };

            lockedBalance = lockedBalance.plus(transaction.amount);

            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
                transaction.recipientId,
            );
            walletsToIndex[wallet.getAddress()] = wallet;
            walletsToIndex[recipientWallet.getAddress()] = recipientWallet;

            wallet.setAttribute("htlc.locks", locks);
            wallet.setAttribute("htlc.lockedBalance", lockedBalance);
        }

        for (const wallet of Object.values(walletsToIndex)) {
            this.walletRepository.index(wallet);
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().htlcEnabled;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(transaction.data.asset?.lock);

        const lock: Interfaces.IHtlcLockAsset = transaction.data.asset.lock;
        const lastBlock: Interfaces.IBlock = this.app.get<any>(Container.Identifiers.StateStore).getLastBlock();

        let { activeDelegates } = Managers.configManager.getMilestone();
        let blockTime = Utils.calculateBlockTime(lastBlock.data.height);
        const expiration: Interfaces.IHtlcExpiration = lock.expiration;

        // TODO: find a better way to alter minimum lock expiration
        if (process.env.CORE_ENV === "test") {
            blockTime = 0;
            activeDelegates = 0;
        }

        if (AppUtils.expirationCalculator.calculateLockExpirationStatus(lastBlock, lock.expiration)) {
            throw new HtlcLockExpiredError();
        }

        if (
            (expiration.type === Enums.HtlcLockExpirationType.EpochTimestamp &&
                expiration.value <= lastBlock.data.timestamp + blockTime * activeDelegates) ||
            (expiration.type === Enums.HtlcLockExpirationType.BlockHeight &&
                expiration.value <= lastBlock.data.height + activeDelegates)
        ) {
            throw new HtlcLockExpiresTooSoonError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const lockedBalance = senderWallet.getAttribute<Utils.BigNumber>("htlc.lockedBalance", Utils.BigNumber.ZERO);
        senderWallet.setAttribute("htlc.lockedBalance", lockedBalance.plus(transaction.data.amount));

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const lockedBalance = senderWallet.getAttribute<Utils.BigNumber>("htlc.lockedBalance", Utils.BigNumber.ZERO);
        const newLockedBalance = lockedBalance.minus(transaction.data.amount);

        if (newLockedBalance.isZero()) {
            senderWallet.forgetAttribute("htlc.lockedBalance");
            senderWallet.forgetAttribute("htlc.locks"); // zero lockedBalance means no pending locks
            senderWallet.forgetAttribute("htlc");
        } else {
            senderWallet.setAttribute("htlc.lockedBalance", newLockedBalance);
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        // It may seem that htlc-lock doesn't have recipient because it only updates sender's wallet.
        // But actually applyToSender applies state changes that only affect sender.
        // While applyToRecipient applies state changes that can affect others.
        // It is simple technique to isolate different senders in pool.

        AppUtils.assert.defined<string>(transaction.id);
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);
        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(transaction.data.asset?.lock);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const locks = senderWallet.getAttribute<Interfaces.IHtlcLocks>("htlc.locks", {});
        locks[transaction.id] = {
            amount: transaction.data.amount,
            recipientId: transaction.data.recipientId,
            timestamp: transaction.timestamp,
            memo: transaction.data.memo,
            ...transaction.data.asset.lock,
        };
        senderWallet.setAttribute("htlc.locks", locks);

        this.walletRepository.index(senderWallet);
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.id);
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const locks = senderWallet.getAttribute<Interfaces.IHtlcLocks>("htlc.locks", {});
        delete locks[transaction.id];

        if (Object.keys(locks).length === 0) {
            senderWallet.forgetAttribute("htlc.locks");
        } else {
            senderWallet.setAttribute("htlc.locks", locks);
        }

        this.walletRepository.index(senderWallet);
    }
}

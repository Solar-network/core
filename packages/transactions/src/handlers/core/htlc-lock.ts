import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { HtlcLockExpiredError, HtlcLockExpiresTooSoonError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class HtlcLockTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["htlc", "htlc.locks", "htlc.lockedBalance", "htlc.pendingBalance"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.HtlcLockTransaction;
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
                this.walletRepository.index(wallet);
            }
        }

        const transactions = await this.transactionRepository.getOpenHtlcLocks();
        const walletsToIndex: Record<string, Contracts.State.Wallet> = {};
        for (const transaction of transactions) {
            const lockWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

            let lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);

            locks[transaction.id] = {
                amount: Utils.BigNumber.make(transaction.amount),
                recipientId: transaction.recipientId,
                senderId: transaction.senderId,
                timestamp: transaction.timestamp,
                memo: transaction.memo ? Buffer.from(transaction.memo, "hex").toString("utf8") : undefined,
                ...transaction.asset.lock,
            };

            lockedBalance = lockedBalance.plus(transaction.amount);

            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
                transaction.recipientId,
            );

            let pendingBalance: Utils.BigNumber = recipientWallet.getAttribute(
                "htlc.pendingBalance",
                Utils.BigNumber.ZERO,
            );
            pendingBalance = pendingBalance.plus(transaction.amount);

            walletsToIndex[lockWallet.getAddress()] = lockWallet;
            walletsToIndex[recipientWallet.getAddress()] = recipientWallet;

            lockWallet.setAttribute("htlc.lockedBalance", lockedBalance);
            lockWallet.setAttribute("htlc.locks", locks);
            recipientWallet.setAttribute("htlc.pendingBalance", pendingBalance);
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

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const lockedBalance = senderWallet.getAttribute<Utils.BigNumber>("htlc.lockedBalance", Utils.BigNumber.ZERO);
        senderWallet.setAttribute("htlc.lockedBalance", lockedBalance.plus(transaction.data.amount));

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const lockedBalance = senderWallet.getAttribute<Utils.BigNumber>("htlc.lockedBalance", Utils.BigNumber.ZERO);
        const newLockedBalance = lockedBalance.minus(transaction.data.amount);
        const pendingBalance: Utils.BigNumber = senderWallet.getAttribute("htlc.pendingBalance", Utils.BigNumber.ZERO);

        if (newLockedBalance.isZero()) {
            senderWallet.forgetAttribute("htlc.lockedBalance");
            senderWallet.forgetAttribute("htlc.locks"); // zero lockedBalance means no pending locks
            if (pendingBalance.isZero()) {
                senderWallet.forgetAttribute("htlc");
            }
        } else {
            senderWallet.setAttribute("htlc.lockedBalance", newLockedBalance);
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.id);
        AppUtils.assert.defined<string>(transaction.data.recipientId);
        AppUtils.assert.defined<string>(transaction.data.senderId);
        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(transaction.data.asset?.lock);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const locks = senderWallet.getAttribute<Interfaces.IHtlcLocks>("htlc.locks", {});
        locks[transaction.id] = {
            amount: transaction.data.amount,
            recipientId: transaction.data.recipientId,
            senderId: transaction.data.senderId,
            timestamp: transaction.timestamp,
            memo: transaction.data.memo,
            ...transaction.data.asset.lock,
        };
        senderWallet.setAttribute("htlc.locks", locks);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            transaction.data.recipientId,
        );

        const pendingBalance = recipientWallet.getAttribute<Utils.BigNumber>(
            "htlc.pendingBalance",
            Utils.BigNumber.ZERO,
        );
        recipientWallet.setAttribute("htlc.pendingBalance", pendingBalance.plus(transaction.data.amount));

        this.walletRepository.index(recipientWallet);
        this.walletRepository.index(senderWallet);
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.id);
        AppUtils.assert.defined<string>(transaction.data.recipientId);
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const locks = senderWallet.getAttribute<Interfaces.IHtlcLocks>("htlc.locks", {});
        delete locks[transaction.id];

        if (Object.keys(locks).length === 0) {
            senderWallet.forgetAttribute("htlc.locks");
        } else {
            senderWallet.setAttribute("htlc.locks", locks);
        }

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            transaction.data.recipientId,
        );

        const pendingBalance = recipientWallet.getAttribute<Utils.BigNumber>(
            "htlc.pendingBalance",
            Utils.BigNumber.ZERO,
        );
        const newPendingBalance = pendingBalance.minus(transaction.data.amount);

        const lockedBalance: Utils.BigNumber = recipientWallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);

        if (newPendingBalance.isZero()) {
            recipientWallet.forgetAttribute("htlc.pendingBalance");
            if (lockedBalance.isZero()) {
                recipientWallet.forgetAttribute("htlc");
            }
        } else {
            recipientWallet.setAttribute("htlc.pendingBalance", newPendingBalance);
        }

        this.walletRepository.index(recipientWallet);
        this.walletRepository.index(senderWallet);
    }
}

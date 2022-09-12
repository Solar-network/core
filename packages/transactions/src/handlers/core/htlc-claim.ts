import { Crypto, Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import { strict } from "assert";

import { HtlcLockExpiredError, HtlcLockTransactionNotFoundError, HtlcSecretHashMismatchError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { HtlcLockTransactionHandler } from "./htlc-lock";

@Container.injectable()
export class HtlcClaimTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [HtlcLockTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["htlc", "htlc.locks", "htlc.lockedBalance", "htlc.pendingBalance"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.HtlcClaimTransaction;
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

        const balances = await this.transactionRepository.getClaimedHtlcLockBalances();
        for (const { recipientId, claimedBalance } of balances) {
            const claimWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(recipientId);
            claimWallet.increaseBalance(Utils.BigNumber.make(claimedBalance));
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().htlcEnabled;
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        // override dynamicFee calculation as this is a zero-fee transaction
        return Utils.BigNumber.ZERO;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        sender: Contracts.State.Wallet,
    ): Promise<void> {
        await this.performGenericWalletChecks(transaction, sender);

        // Specific HTLC claim checks

        AppUtils.assert.defined<Interfaces.ITransactionAsset>(transaction.data.asset?.claim);

        const claimAsset: Interfaces.IHtlcClaimAsset = transaction.data.asset.claim;
        const lockId: string = claimAsset.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );
        if (!lockWallet || !lockWallet.getAttribute("htlc.locks", {})[lockId]) {
            throw new HtlcLockTransactionNotFoundError();
        }

        const lock: Interfaces.IHtlcLock = lockWallet.getAttribute("htlc.locks", {})[lockId];
        const lastBlock: Interfaces.IBlock = this.app
            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
            .getLastBlock();

        if (AppUtils.expirationCalculator.calculateLockExpirationStatus(lastBlock, lock.expiration)) {
            throw new HtlcLockExpiredError();
        }

        const unlockSecretBytes = Buffer.from(claimAsset.unlockSecret, "hex");

        let hashAlgorithm: any;

        switch (claimAsset.hashType) {
            case Enums.HtlcSecretHashType.SHA256: {
                hashAlgorithm = Crypto.HashAlgorithms.sha256;
                break;
            }
            case Enums.HtlcSecretHashType.SHA384: {
                hashAlgorithm = Crypto.HashAlgorithms.sha384;
                break;
            }
            case Enums.HtlcSecretHashType.SHA512: {
                hashAlgorithm = Crypto.HashAlgorithms.sha512;
                break;
            }
            case Enums.HtlcSecretHashType.SHA3256: {
                hashAlgorithm = Crypto.HashAlgorithms.sha3256;
                break;
            }
            case Enums.HtlcSecretHashType.SHA3384: {
                hashAlgorithm = Crypto.HashAlgorithms.sha3384;
                break;
            }
            case Enums.HtlcSecretHashType.SHA3512: {
                hashAlgorithm = Crypto.HashAlgorithms.sha3512;
                break;
            }
            case Enums.HtlcSecretHashType.Keccak256: {
                hashAlgorithm = Crypto.HashAlgorithms.keccak256;
                break;
            }
            case Enums.HtlcSecretHashType.Keccak384: {
                hashAlgorithm = Crypto.HashAlgorithms.keccak384;
                break;
            }
            case Enums.HtlcSecretHashType.Keccak512: {
                hashAlgorithm = Crypto.HashAlgorithms.keccak512;
                break;
            }
        }

        const unlockSecretHash: string = hashAlgorithm(unlockSecretBytes).toString("hex");
        if (lock.secretHash !== unlockSecretHash) {
            throw new HtlcSecretHashMismatchError();
        }
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.asset?.claim?.lockTransactionId);

        const lockId: string = transaction.data.asset.claim.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );

        if (!lockWallet || !lockWallet.getAttribute("htlc.locks", {})[lockId]) {
            throw new Contracts.Pool.PoolError(
                `The associated lock transaction id "${lockId}" was not found`,
                "ERR_HTLC_LOCK_NOT_FOUND",
            );
        }

        const hasClaim: boolean = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset?.claim?.lockTransactionId === lockId)
            .has();

        if (hasClaim) {
            throw new Contracts.Pool.PoolError(`HtlcClaim for '${lockId}' already in the pool`, "ERR_PENDING");
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const data: Interfaces.ITransactionData = transaction.data;

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.assert.defined<string>(data.asset?.claim?.lockTransactionId);

        const lockId: string = data.asset.claim.lockTransactionId;
        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByIndex(
            Contracts.State.WalletIndexes.Locks,
            lockId,
        );

        strict(lockWallet && lockWallet.getAttribute("htlc.locks")[lockId]);

        const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

        const recipientId: string | undefined = locks[lockId].recipientId;

        AppUtils.assert.defined<string>(recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(recipientId);

        recipientWallet.increaseBalance(locks[lockId].amount);
        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance");
        const newLockedBalance: Utils.BigNumber = lockedBalance.minus(locks[lockId].amount);

        strict(!newLockedBalance.isNegative());

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

        const pendingBalance: Utils.BigNumber = recipientWallet.getAttribute("htlc.pendingBalance");
        const newPendingBalance: Utils.BigNumber = pendingBalance.minus(locks[lockId].amount);

        strict(!newPendingBalance.isNegative());

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

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const data: Interfaces.ITransactionData = transaction.data;

        AppUtils.assert.defined<string>(data.asset?.claim?.lockTransactionId);

        const lockId: string = data.asset.claim.lockTransactionId;

        const lockTransaction = (await this.transactionRepository.findByIds([lockId]))[0];

        AppUtils.assert.defined<Interfaces.ITransactionData>(lockTransaction.recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            lockTransaction.recipientId,
        );
        recipientWallet.decreaseBalance(lockTransaction.amount);

        const pendingBalance: Utils.BigNumber = recipientWallet.getAttribute(
            "htlc.pendingBalance",
            Utils.BigNumber.ZERO,
        );
        recipientWallet.setAttribute("htlc.pendingBalance", pendingBalance.plus(lockTransaction.amount));

        AppUtils.assert.defined<string>(lockTransaction.senderId);

        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(lockTransaction.senderId);
        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);
        lockWallet.setAttribute("htlc.lockedBalance", lockedBalance.plus(lockTransaction.amount));

        const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(lockTransaction.asset?.lock);

        AppUtils.assert.defined<string>(lockTransaction.id);

        locks[lockTransaction.id] = {
            amount: lockTransaction.amount,
            recipientId: lockTransaction.recipientId,
            senderId: lockTransaction.senderId,
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

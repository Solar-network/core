import { Container, Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { Crypto, Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { strict } from "assert";

import { HtlcLockExpiredError, HtlcLockTransactionNotFoundError, HtlcSecretHashMismatchError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { HtlcLockTransactionHandler } from "./htlc-lock";

@Container.injectable()
export class HtlcClaimTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [HtlcLockTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["htlc", "htlc.locks", "htlc.lockedBalance"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.HtlcClaimTransaction;
    }

    public async bootstrap(): Promise<void> {
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
            throw new Contracts.TransactionPool.PoolError(
                `The associated lock transaction id "${lockId}" was not found`,
                "ERR_HTLCLOCKNOTFOUND",
            );
        }

        const hasClaim: boolean = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset?.claim?.lockTransactionId === lockId)
            .has();

        if (hasClaim) {
            throw new Contracts.TransactionPool.PoolError(
                `HtlcClaim for '${lockId}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const data: Interfaces.ITransactionData = transaction.data;

        if (Utils.isException(data)) {
            this.logger.warning(`Transaction forcibly applied as an exception: ${transaction.id}`);
        }

        await this.throwIfCannotBeApplied(transaction, sender);

        this.verifyTransactionNonceApply(sender, transaction);

        AppUtils.assert.defined<Utils.BigNumber>(data.nonce);

        sender.setNonce(data.nonce);

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

        recipientWallet.increaseBalance(locks[lockId].amount.minus(data.fee));
        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance");
        const newLockedBalance: Utils.BigNumber = lockedBalance.minus(locks[lockId].amount);

        strict(!newLockedBalance.isNegative());

        if (newLockedBalance.isZero()) {
            lockWallet.forgetAttribute("htlc.lockedBalance");
            lockWallet.forgetAttribute("htlc.locks"); // zero lockedBalance means no pending locks
            lockWallet.forgetAttribute("htlc");
        } else {
            lockWallet.setAttribute("htlc.lockedBalance", newLockedBalance);
        }

        delete locks[lockId];

        this.walletRepository.index(sender);
        this.walletRepository.index(lockWallet);
        this.walletRepository.index(recipientWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const data: Interfaces.ITransactionData = transaction.data;

        this.verifyTransactionNonceRevert(sender, transaction);

        sender.decreaseNonce();

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);
        AppUtils.assert.defined<string>(data.asset?.claim?.lockTransactionId);

        const lockId: string = data.asset.claim.lockTransactionId;

        const lockTransaction: Interfaces.ITransactionData = (await this.transactionRepository.findByIds([lockId]))[0];

        AppUtils.assert.defined<Interfaces.ITransactionData>(lockTransaction.recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            lockTransaction.recipientId,
        );
        recipientWallet.decreaseBalance(lockTransaction.amount.minus(data.fee));

        AppUtils.assert.defined<string>(lockTransaction.senderPublicKey);

        const lockWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            lockTransaction.senderPublicKey,
        );
        const lockedBalance: Utils.BigNumber = lockWallet.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO);
        lockWallet.setAttribute("htlc.lockedBalance", lockedBalance.plus(lockTransaction.amount));

        const locks: Interfaces.IHtlcLocks = lockWallet.getAttribute("htlc.locks", {});

        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(lockTransaction.asset?.lock);

        AppUtils.assert.defined<string>(lockTransaction.id);

        locks[lockTransaction.id] = {
            amount: lockTransaction.amount,
            recipientId: lockTransaction.recipientId,
            timestamp: lockTransaction.timestamp,
            memo: lockTransaction.memo ? Buffer.from(lockTransaction.memo, "hex").toString("utf8") : undefined,
            ...lockTransaction.asset.lock,
        };
        lockWallet.setAttribute("htlc.locks", locks);

        this.walletRepository.index(sender);
        this.walletRepository.index(lockWallet);
        this.walletRepository.index(recipientWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

import { Enums, Identities, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import assert from "assert";

import {
    ColdWalletError,
    InsufficientBalanceError,
    InvalidMultiSignaturesError,
    InvalidSecondSignatureError,
    MissingMultiSignatureOnSenderError,
    SenderWalletMismatchError,
    TransactionFeeTooLowError,
    UnexpectedNonceError,
    UnexpectedSecondSignatureError,
} from "../errors";

// todo: revisit the implementation, container usage and arguments after database rework
@Container.injectable()
export abstract class TransactionHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    protected readonly blockRepository!: Repositories.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    protected readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    protected readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    protected readonly stateWalletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.LogService)
    protected readonly logger!: Contracts.Kernel.Logger;

    public async verify(transaction: Interfaces.ITransaction): Promise<boolean> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        if (this.walletRepository.hasByPublicKey(transaction.data.senderPublicKey)) {
            const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
                transaction.data.senderPublicKey,
            );

            if (senderWallet.hasMultiSignature()) {
                transaction.isVerified = this.verifySignatures(senderWallet, transaction.data);
            }
        }

        return transaction.isVerified;
    }

    public dynamicFee({
        addonBytes,
        satoshiPerByte,
        transaction,
    }: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        addonBytes = addonBytes || 0;

        if (satoshiPerByte <= 0) {
            satoshiPerByte = 1;
        }

        const transactionSizeInBytes: number = Math.round(transaction.serialised.length / 2);
        return Utils.BigNumber.make(addonBytes + transactionSizeInBytes).times(satoshiPerByte);
    }

    public getMinimumFee(
        transaction: Interfaces.ITransaction,
        dynamicFeesConfiguration: { addonBytes: object; enabled: boolean; minFee: number } | Record<string, any>,
    ): Utils.BigNumber {
        if (dynamicFeesConfiguration && dynamicFeesConfiguration.enabled) {
            const addonBytes: number = dynamicFeesConfiguration.addonBytes[transaction.key];

            const minFee: Utils.BigNumber = this.dynamicFee({
                transaction,
                addonBytes,
                satoshiPerByte: dynamicFeesConfiguration.minFee,
            });

            return minFee;
        }
        return Utils.BigNumber.ZERO;
    }

    public enforceMinimumFee(
        transaction: Interfaces.ITransaction,
        dynamicFeesConfiguration: { addonBytes: object; enabled: boolean; minFee: number },
    ): void {
        if (dynamicFeesConfiguration && dynamicFeesConfiguration.enabled) {
            const minFee = this.getMinimumFee(transaction, dynamicFeesConfiguration);

            if (transaction.data.fee.isLessThan(minFee)) {
                throw new TransactionFeeTooLowError(transaction.data.fee, minFee);
            }
        }
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        sender: Contracts.State.Wallet,
    ): Promise<void> {
        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(sender.getAddress());

        AppUtils.assert.defined<string>(sender.getPublicKey());

        if (!this.walletRepository.hasByPublicKey(sender.getPublicKey()!) && senderWallet.getBalance().isZero()) {
            throw new ColdWalletError();
        }

        const milestone = Managers.configManager.getMilestone();
        this.enforceMinimumFee(transaction, milestone.dynamicFees);

        return this.performGenericWalletChecks(transaction, sender);
    }

    public async apply(transaction: Interfaces.ITransaction): Promise<void> {
        try {
            await this.applyToSender(transaction);
            await this.applyToRecipient(transaction);
        } finally {
            await this.index(transaction);
        }
    }

    public async revert(transaction: Interfaces.ITransaction): Promise<void> {
        try {
            await this.revertForSender(transaction);
            await this.revertForRecipient(transaction);
        } finally {
            await this.index(transaction);
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const data: Interfaces.ITransactionData = transaction.data;

        if (Utils.isException(data)) {
            this.logger.warning(`Transaction forcibly applied as an exception: ${transaction.id}`);
        }

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        await this.throwIfCannotBeApplied(transaction, sender);

        this.verifyTransactionNonceApply(sender, transaction);

        AppUtils.assert.defined<Utils.BigNumber>(data.nonce);

        sender.setNonce(data.nonce);

        const newBalance: Utils.BigNumber = sender
            .getBalance()
            .minus(data.amount || Utils.BigNumber.ZERO)
            .minus(data.fee);

        assert(Utils.isException(transaction.data) || !newBalance.isNegative());

        sender.setBalance(newBalance);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const data: Interfaces.ITransactionData = transaction.data;

        const amount: Utils.BigNumber = data.amount || Utils.BigNumber.ZERO;
        sender.increaseBalance(amount.plus(data.fee));

        this.verifyTransactionNonceRevert(sender, transaction);

        sender.decreaseNonce();
    }

    /**
     * Database Service
     */
    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {}

    /**
     * Pool logic
     */
    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {}

    /**
     * @param {Contracts.State.Wallet} wallet
     * @param {Interfaces.ITransactionData} transaction
     * @param {Interfaces.IMultiSignatureAsset} [multiSignature]
     * @returns {boolean}
     * @memberof TransactionHandler
     */
    public verifySignatures(
        wallet: Contracts.State.Wallet,
        transaction: Interfaces.ITransactionData,
        multiSignature?: Interfaces.IMultiSignatureAsset,
    ): boolean {
        return Transactions.Verifier.verifySignatures(
            transaction,
            multiSignature || wallet.getAttribute("multiSignature"),
        );
    }

    protected async performGenericWalletChecks(
        transaction: Interfaces.ITransaction,
        sender: Contracts.State.Wallet,
    ): Promise<void> {
        const data: Interfaces.ITransactionData = transaction.data;

        if (Utils.isException(data)) {
            return;
        }

        this.verifyTransactionNonceApply(sender, transaction);

        const amount: Utils.BigNumber = data.amount || Utils.BigNumber.ZERO;

        if (sender.getBalance().minus(amount).minus(data.fee).isNegative()) {
            throw new InsufficientBalanceError(amount.plus(data.fee), sender.getBalance());
        }

        if (data.senderPublicKey !== sender.getPublicKey()) {
            throw new SenderWalletMismatchError();
        }

        if (sender.hasSecondSignature()) {
            AppUtils.assert.defined<string>(data.senderPublicKey);

            // Ensure the database wallet already has a 2nd signature, in case we checked a pool wallet.
            const dbSender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(data.senderPublicKey);

            if (!dbSender.hasSecondSignature()) {
                throw new UnexpectedSecondSignatureError();
            }

            if (!Transactions.Verifier.verifySecondSignature(data, dbSender.getAttribute("secondPublicKey"))) {
                throw new InvalidSecondSignatureError();
            }
        } else if (data.secondSignature || data.signSignature) {
            throw new UnexpectedSecondSignatureError();
        }

        if (sender.hasMultiSignature()) {
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            // Ensure the database wallet already has a multisignature, in case we checked a pool wallet.
            const dbSender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
                transaction.data.senderPublicKey,
            );

            if (!dbSender.hasMultiSignature()) {
                throw new MissingMultiSignatureOnSenderError();
            }

            if (!this.verifySignatures(dbSender, data, dbSender.getAttribute("multiSignature"))) {
                throw new InvalidMultiSignaturesError();
            }
        } else if (transaction.data.signatures) {
            throw new MissingMultiSignatureOnSenderError();
        }
    }

    /**
     * Verify that the transaction's nonce is the wallet nonce plus one, so that the
     * transaction can be applied to the wallet. Throw an exception if it is not.
     *
     * @param {Interfaces.ITransaction} transaction
     * @memberof Wallet
     */
    protected verifyTransactionNonceApply(wallet: Contracts.State.Wallet, transaction: Interfaces.ITransaction): void {
        const nonce: Utils.BigNumber = transaction.data.nonce || Utils.BigNumber.ZERO;

        if (!wallet.getNonce().plus(1).isEqualTo(nonce)) {
            throw new UnexpectedNonceError(nonce, wallet, false);
        }
    }

    /**
     * Verify that the transaction's nonce is the same as the wallet nonce, so that the
     * transaction can be reverted from the wallet. Throw an exception if it is not.
     *
     * @param wallet
     * @param {Interfaces.ITransaction} transaction
     * @memberof Wallet
     */
    protected verifyTransactionNonceRevert(wallet: Contracts.State.Wallet, transaction: Interfaces.ITransaction): void {
        const nonce: Utils.BigNumber = transaction.data.nonce || Utils.BigNumber.ZERO;

        if (!wallet.getNonce().isEqualTo(nonce)) {
            throw new UnexpectedNonceError(nonce, wallet, true);
        }
    }

    private indexRepositories(repositories: Contracts.State.WalletRepository[], addresses: string[]) {
        for (const address of addresses) {
            for (const repository of repositories) {
                if (repository.hasByAddress(address)) {
                    repository.index(repository.findByAddress(address));
                }
            }
        }
    }

    private async index(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderId = Identities.Address.fromPublicKey(transaction.data.senderPublicKey);

        const repositories = [this.stateWalletRepository];
        const addresses = [senderId];

        if (this.stateWalletRepository !== this.walletRepository) {
            repositories.push(this.walletRepository);
        }

        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            addresses.push(transaction.data.recipientId);
        }

        if (transaction.data.typeGroup === Enums.TransactionTypeGroup.Core) {
            if (transaction.data.type === Enums.TransactionType.Core.Transfer) {
                AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

                for (const { recipientId } of transaction.data.asset.transfers) {
                    addresses.push(recipientId);
                }
            }

            if (transaction.data.type === Enums.TransactionType.Core.HtlcClaim) {
                try {
                    AppUtils.assert.defined<Interfaces.IHtlcClaimAsset>(transaction.data.asset?.claim);

                    const lockId = transaction.data.asset.claim.lockTransactionId;
                    const lockSenderWallet = this.walletRepository.findByIndex(
                        Contracts.State.WalletIndexes.Locks,
                        lockId,
                    );
                    const locks: Interfaces.IHtlcLocks = lockSenderWallet.getAttribute("htlc.locks", {});

                    let lockRecipientId: string | undefined;

                    if (locks[lockId] && locks[lockId].recipientId) {
                        lockRecipientId = locks[lockId].recipientId;
                    } else {
                        const lockTransaction: Interfaces.ITransactionData = (
                            await this.transactionRepository.findByIds([lockId])
                        )[0];

                        lockRecipientId = lockTransaction.recipientId;
                    }

                    AppUtils.assert.defined<Interfaces.ITransactionData>(lockRecipientId);

                    const lockSenderId = lockSenderWallet.getAddress();

                    addresses.push(...[lockSenderId, lockRecipientId]);
                } catch {
                    //
                }
            }
        }

        this.indexRepositories(repositories, addresses);
    }

    public abstract getConstructor(): Transactions.TransactionConstructor;

    public abstract dependencies(): ReadonlyArray<TransactionHandlerConstructor>;

    public abstract walletAttributes(): ReadonlyArray<string>;

    public abstract isActivated(): Promise<boolean>;

    /**
     * Wallet logic
     */

    public abstract bootstrap(): Promise<void>;

    public abstract applyToRecipient(transaction: Interfaces.ITransaction): Promise<void>;

    public abstract revertForRecipient(transaction: Interfaces.ITransaction): Promise<void>;
}

export type TransactionHandlerConstructor = new () => TransactionHandler;

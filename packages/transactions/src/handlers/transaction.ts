import { Enums, Identities, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import assert from "assert";

import {
    ColdWalletError,
    InsufficientBalanceError,
    InvalidExtraSignatureError,
    SenderWalletMismatchError,
    TransactionFeeTooLowError,
    UnexpectedExtraSignatureError,
    UnexpectedHeaderTypeError,
    UnexpectedNonceError,
} from "../errors";

// todo: revisit the implementation, container usage and arguments after database rework
@Container.injectable()
export abstract class TransactionHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    protected readonly blockRepository!: Contracts.Database.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    protected readonly transactionRepository!: Contracts.Database.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    protected readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    protected readonly stateWalletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.LogService)
    protected readonly logger!: Contracts.Kernel.Logger;

    public async verify(transaction: Interfaces.ITransaction): Promise<boolean> {
        return transaction.isVerified;
    }

    public fee({ bytes, satoshiPerByte, transaction }: Contracts.Shared.FeeContext): Utils.BigNumber {
        bytes = bytes || 0;

        if (satoshiPerByte <= 0) {
            satoshiPerByte = 1;
        }

        const transactionSizeInBytes: number = Math.round(transaction.serialised.length / 2);
        return Utils.BigNumber.make(bytes + transactionSizeInBytes).times(satoshiPerByte);
    }

    public getMinimumFee(
        transaction: Interfaces.ITransaction,
        configuration: { bytes: object; minFee: number } | Record<string, any>,
    ): Utils.BigNumber {
        if (configuration) {
            const bytes: number = configuration.bytes[transaction.key];

            const minFee: Utils.BigNumber = this.fee({
                transaction,
                bytes,
                satoshiPerByte: configuration.minFee,
            });

            return minFee;
        }
        return Utils.BigNumber.ZERO;
    }

    public enforceMinimumFee(
        transaction: Interfaces.ITransaction,
        configuration: { bytes: object; minFee: number },
    ): void {
        if (configuration) {
            const minFee = this.getMinimumFee(transaction, configuration);

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

        AppUtils.assert.defined<string>(sender.getPublicKey("primary"));
        if (
            !this.walletRepository.hasByPublicKey(sender.getPublicKey("primary")!) &&
            senderWallet.getBalance().isZero()
        ) {
            throw new ColdWalletError();
        }

        const milestone = Managers.configManager.getMilestone();
        this.enforceMinimumFee(transaction, milestone.fees);

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
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const data: Interfaces.ITransactionData = transaction.data;

        if (Utils.isException(data)) {
            this.logger.warning(`Transaction forcibly applied as an exception: ${transaction.id}`, "🪲");
        }

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);
        if (
            transaction.data.headerType === Enums.TransactionHeaderType.Standard &&
            senderWallet.getPublicKey("primary") === undefined
        ) {
            senderWallet.setPublicKey(transaction.data.senderPublicKey, "primary");
            this.walletRepository.index(senderWallet);
        }

        await this.throwIfCannotBeApplied(transaction, senderWallet);

        this.verifyTransactionNonceApply(senderWallet, transaction);

        AppUtils.assert.defined<Utils.BigNumber>(data.nonce);

        senderWallet.setNonce(data.nonce);

        const newBalance: Utils.BigNumber = senderWallet.getBalance().minus(data.fee);

        assert(Utils.isException(transaction.data) || !newBalance.isNegative());

        senderWallet.setBalance(newBalance);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const data: Interfaces.ITransactionData = transaction.data;

        senderWallet.increaseBalance(data.fee);

        this.verifyTransactionNonceRevert(senderWallet, transaction);

        senderWallet.decreaseNonce();

        if (senderWallet.getNonce().isZero()) {
            senderWallet.forgetPublicKey("primary");
        }
    }

    /**
     * Database Service
     */
    public emitEvents(transaction: Interfaces.ITransaction): void {}

    /**
     * Pool logic
     */
    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {}

    public getWallet(address: string): Contracts.State.Wallet | undefined {
        if (this.walletRepository.hasByAddress(address)) {
            return this.walletRepository.findByAddress(address);
        }

        return undefined;
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

        if (sender.getBalance().minus(data.fee).isNegative()) {
            throw new InsufficientBalanceError(data.fee, sender.getBalance());
        }

        if (data.headerType === Enums.TransactionHeaderType.Standard) {
            if (
                data.senderPublicKey !== sender.getPublicKey("primary") ||
                data.senderId !== Identities.Address.fromPublicKey(data.senderPublicKey)
            ) {
                throw new SenderWalletMismatchError();
            }
        } else {
            throw new UnexpectedHeaderTypeError();
        }

        if (sender.hasPublicKeyByType("extra")) {
            AppUtils.assert.defined<string>(data.senderId);

            // Ensure the database wallet already has a 2nd signature, in case we checked a pool wallet.
            const dbSender: Contracts.State.Wallet = this.walletRepository.findByAddress(data.senderId);

            if (!dbSender.hasPublicKeyByType("extra")) {
                throw new UnexpectedExtraSignatureError();
            }

            if (!Transactions.Verifier.verifyExtraSignature(transaction, dbSender.getPublicKey("extra")!)) {
                throw new InvalidExtraSignatureError();
            }
        } else if (data.signatures && data.signatures.extra) {
            throw new UnexpectedExtraSignatureError();
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
                setImmediate(() => {
                    if (repository.hasByAddress(address)) {
                        repository.index(repository.findByAddress(address));
                    }
                });
            }
        }
    }

    private async index(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const repositories: Contracts.State.WalletRepository[] = [this.stateWalletRepository];

        const addresses = [transaction.data.senderId];

        if (this.stateWalletRepository !== this.walletRepository) {
            repositories.push(this.walletRepository);
        }

        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            addresses.push(transaction.data.recipientId);
        }

        if (transaction.data.type === "transfer") {
            AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

            for (const { recipientId } of transaction.data.asset.recipients) {
                addresses.push(recipientId);
            }
        }

        this.indexRepositories(repositories, addresses);
    }

    public abstract getConstructor(): Transactions.TransactionConstructor;

    public abstract dependencies(): ReadonlyArray<TransactionHandlerConstructor>;

    public abstract walletAttributes(): ReadonlyArray<string>;

    public abstract isActivated(transaction?: Interfaces.ITransaction): Promise<boolean>;

    /**
     * Wallet logic
     */

    public abstract bootstrap(): Promise<void>;

    public abstract applyToRecipient(transaction: Interfaces.ITransaction): Promise<void>;

    public abstract revertForRecipient(transaction: Interfaces.ITransaction): Promise<void>;
}

export type TransactionHandlerConstructor = new () => TransactionHandler;

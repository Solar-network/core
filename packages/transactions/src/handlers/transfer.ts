import { Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { InsufficientBalanceError } from "../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class TransferTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.TransferTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<object>(transaction.asset?.recipients);
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            this.performWalletInitialisation(transaction, wallet);

            const processedRecipientWallets: Contracts.State.Wallet[] = [];
            for (const transfer of transaction.asset.recipients) {
                const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
                    transfer.recipientId,
                );
                recipientWallet.increaseBalance(transfer.amount);
                wallet.decreaseBalance(transfer.amount);

                if (!processedRecipientWallets.includes(recipientWallet)) {
                    processedRecipientWallets.push(recipientWallet);
                    recipientWallet.increaseReceivedTransactions(transaction);
                }
            }
        }
    }

    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        const recipients: Interfaces.ITransferRecipient[] = transaction.data.asset.recipients;
        const totalAmount = recipients.reduce((a, p) => a.plus(p.amount), Utils.BigNumber.ZERO);

        if (wallet.getBalance().minus(totalAmount).minus(transaction.data.fee).isNegative()) {
            throw new InsufficientBalanceError(totalAmount.plus(transaction.data.fee), wallet.getBalance());
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        const totalAmount = transaction.data.asset.recipients.reduce((a, p) => a.plus(p.amount), Utils.BigNumber.ZERO);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        senderWallet.decreaseBalance(totalAmount);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        const totalPaymentsAmount = transaction.data.asset.recipients.reduce(
            (a, p) => a.plus(p.amount),
            Utils.BigNumber.ZERO,
        );

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        senderWallet.increaseBalance(totalPaymentsAmount);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        const processedRecipientWallets: Contracts.State.Wallet[] = [];
        for (const transfer of transaction.data.asset.recipients) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.increaseBalance(transfer.amount);

            if (!processedRecipientWallets.includes(recipientWallet)) {
                processedRecipientWallets.push(recipientWallet);
                recipientWallet.increaseReceivedTransactions(transaction.data);
            }
        }
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        const processedRecipientWallets: Contracts.State.Wallet[] = [];
        for (const transfer of transaction.data.asset.recipients) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.decreaseBalance(transfer.amount);

            if (!processedRecipientWallets.includes(recipientWallet)) {
                processedRecipientWallets.push(recipientWallet);

                const previousTransaction: Interfaces.ITransactionData | undefined =
                    await this.transactionRepository.getPreviousReceivedTransactionOfType(
                        transaction.data,
                        recipientWallet.getAddress(),
                    );
                recipientWallet.decreaseReceivedTransactions(transaction.data, previousTransaction);
            }
        }
    }
}

import { Enums, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { InsufficientBalanceError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

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
        return Transactions.Core.TransferTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<object>(transaction.asset?.recipients);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
                this.walletRepository.index(wallet);
            }

            for (const transfer of transaction.asset.recipients) {
                const recipient: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);
                recipient.increaseBalance(transfer.amount);
                wallet.decreaseBalance(transfer.amount);
            }
        }
    }

    public async isActivated(): Promise<boolean> {
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

        for (const transfer of transaction.data.asset.recipients) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.increaseBalance(transfer.amount);
        }
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transaction.data.asset?.recipients);

        for (const transfer of transaction.data.asset.recipients) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.decreaseBalance(transfer.amount);
        }
    }
}

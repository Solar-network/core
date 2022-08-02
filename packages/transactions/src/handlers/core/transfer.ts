import { Interfaces, Transactions, Utils } from "@solar-network/crypto";
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
            AppUtils.assert.defined<string>(transaction.senderPublicKey);
            AppUtils.assert.defined<object>(transaction.asset?.transfers);

            const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
            for (const transfer of transaction.asset.transfers) {
                const recipient: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);
                recipient.increaseBalance(transfer.amount);
                sender.decreaseBalance(transfer.amount);
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
        AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

        const transfers: Interfaces.ITransferItem[] = transaction.data.asset.transfers;
        const totalTransfersAmount = transfers.reduce((a, p) => a.plus(p.amount), Utils.BigNumber.ZERO);

        if (wallet.getBalance().minus(totalTransfersAmount).minus(transaction.data.fee).isNegative()) {
            throw new InsufficientBalanceError(totalTransfersAmount.plus(transaction.data.fee), wallet.getBalance());
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

        const totalTransfersAmount = transaction.data.asset.transfers.reduce(
            (a, p) => a.plus(p.amount),
            Utils.BigNumber.ZERO,
        );

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        senderWallet.decreaseBalance(totalTransfersAmount);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

        const totalPaymentsAmount = transaction.data.asset.transfers.reduce(
            (a, p) => a.plus(p.amount),
            Utils.BigNumber.ZERO,
        );

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        senderWallet.increaseBalance(totalPaymentsAmount);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

        for (const transfer of transaction.data.asset.transfers) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.increaseBalance(transfer.amount);
        }
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.data.asset?.transfers);

        for (const transfer of transaction.data.asset.transfers) {
            const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transfer.recipientId);

            recipientWallet.decreaseBalance(transfer.amount);
        }
    }
}

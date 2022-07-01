import { Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { isRecipientOnActiveNetwork } from "../../utils";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

// todo: revisit the implementation, container usage and arguments after database rework
// todo: replace unnecessary function arguments with dependency injection to avoid passing around references
@Container.injectable()
export class LegacyTransferTransactionHandler extends TransactionHandler {
    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.LegacyTransferTransaction;
    }

    public async bootstrap(): Promise<void> {
        const transactions = await this.transactionRepository.findReceivedTransactions();
        for (const transaction of transactions) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.recipientId);
            wallet.increaseBalance(Utils.BigNumber.make(transaction.amount));
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().legacyTransfer;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        sender: Contracts.State.Wallet,
    ): Promise<void> {
        return super.throwIfCannotBeApplied(transaction, sender);
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.recipientId);
        const recipientId: string = transaction.data.recipientId;

        if (!isRecipientOnActiveNetwork(recipientId)) {
            const network: string = Managers.configManager.get<string>("network.pubKeyHash");
            throw new Contracts.Pool.PoolError(
                `Recipient ${recipientId} is not on the same network: ${network} `,
                "ERR_INVALID_RECIPIENT",
            );
        }
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.recipientId);

        const recipient: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.recipientId);

        recipient.increaseBalance(transaction.data.amount);
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.recipientId);

        const recipient: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.recipientId);

        recipient.decreaseBalance(transaction.data.amount);
    }
}

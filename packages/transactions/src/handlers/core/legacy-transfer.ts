import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { isRecipientOnActiveNetwork } from "../../utils";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class LegacyTransferTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

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

        const transactions = await this.transactionRepository.findReceivedTransactions();
        for (const transaction of transactions) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.recipientId);
            wallet.increaseBalance(Utils.BigNumber.make(transaction.amount));
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().legacyTransfer;
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

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            transaction.data.recipientId,
        );

        recipientWallet.increaseBalance(transaction.data.amount!);
    }

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.recipientId);

        const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(
            transaction.data.recipientId,
        );

        recipientWallet.decreaseBalance(transaction.data.amount!);
    }
}

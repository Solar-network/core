import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { InsufficientBurnAmountError } from "../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class BurnTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public fee(context: Contracts.Shared.FeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.BurnTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<object>(transaction.asset?.burn);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
                this.walletRepository.index(wallet);
            }

            wallet.decreaseBalance(transaction.asset.burn.amount);
        }
    }

    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        AppUtils.assert.defined<Utils.BigNumber>(transaction.data.asset?.burn?.amount);

        const milestone = Managers.configManager.getMilestone();

        const burnAmount = transaction.data.asset?.burn.amount;
        const txAmount = +milestone.burn.txAmount;

        if (burnAmount.isLessThan(txAmount)) {
            throw new InsufficientBurnAmountError(burnAmount, Utils.BigNumber.make(txAmount));
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [];
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<Utils.BigNumber>(transaction.data.asset?.burn?.amount);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        senderWallet.decreaseBalance(transaction.data.asset.burn.amount);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<Utils.BigNumber>(transaction.data.asset?.burn?.amount);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        senderWallet.increaseBalance(transaction.data.asset.burn.amount);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

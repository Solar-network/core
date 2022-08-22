import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { InsufficientBurnAmountError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class BurnTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Solar.BurnTransaction;
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
                wallet.getPublicKey() === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey);
                this.walletRepository.index(wallet);
            }
        }
    }

    public async isActivated(): Promise<boolean> {
        const milestone = Managers.configManager.getMilestone();
        return typeof milestone.burn === "object" && typeof milestone.burn.txAmount === "number";
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        const { data }: Interfaces.ITransaction = transaction;
        const txAmount = +milestone.burn.txAmount;

        if (data.amount.isLessThan(txAmount)) {
            throw new InsufficientBurnAmountError(data.amount, Utils.BigNumber.make(txAmount));
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [];
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

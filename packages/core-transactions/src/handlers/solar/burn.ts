import { Container, Contracts } from "@solar-network/core-kernel";
import { Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";

import { InsufficientBurnAmountError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class BurnTransactionHandler extends TransactionHandler {
    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Solar.BurnTransaction;
    }

    public async isActivated(): Promise<boolean> {
        const milestone = Managers.configManager.getMilestone();
        return (
            typeof milestone.solarTransactions === "object" &&
            typeof milestone.solarTransactions.burn === "object" &&
            typeof milestone.solarTransactions.burn.minimumAmount === "number"
        );
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        const { data }: Interfaces.ITransaction = transaction;
        const minimumAmount = +milestone.solarTransactions.burn.minimumAmount;

        if (data.amount.isLessThan(minimumAmount)) {
            throw new InsufficientBurnAmountError(data.amount, Utils.BigNumber.make(minimumAmount));
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [];
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async bootstrap(): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

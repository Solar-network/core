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

    public async bootstrap(): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

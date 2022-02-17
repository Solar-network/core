import { Container, Contracts } from "@arkecosystem/core-kernel";
import { Transactions as SolarTransactions } from "@solar-network/solar-crypto";
import { Handlers } from "@arkecosystem/core-transactions";
import { Interfaces, Managers, Transactions, Utils } from "@arkecosystem/crypto";

import { SolarTransactionHandler } from "./handler";

import { InsufficientBurnAmountError } from "./errors";

@Container.injectable()
export class BurnTransactionHandler extends SolarTransactionHandler {
    public dependencies(): ReadonlyArray<Handlers.TransactionHandlerConstructor> {
        return [];
    }

    public dynamicFee(context: Contracts.Shared.DynamicFeeContext): Utils.BigNumber {
        return Utils.BigNumber.ZERO;
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return SolarTransactions.BurnTransaction;
    }

    public async isActivated(): Promise<boolean> {
        const milestone = Managers.configManager.getMilestone();
        return typeof milestone.solarTransactions === "object" && typeof milestone.solarTransactions.burn === "object" && typeof milestone.solarTransactions.burn.minimumAmount === "number";
    }

    public async throwIfCannotBeApplied(transaction: Interfaces.ITransaction, wallet: Contracts.State.Wallet): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        const { data }: Interfaces.ITransaction = transaction;
        if (data.amount.isLessThan(+milestone.solarTransactions.burn.minimumAmount)) {
            throw new InsufficientBurnAmountError(data.amount);
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

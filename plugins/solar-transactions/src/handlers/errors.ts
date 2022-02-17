import { Managers, Utils } from "@arkecosystem/crypto";
import { Errors } from "@arkecosystem/core-transactions";

export class InsufficientBurnAmountError extends Errors.TransactionError {
    public constructor(amount) {
        const milestone = Managers.configManager.getMilestone();
        super(`Failed to apply transaction, because burn amount (${Utils.formatSatoshi(amount)}) is below the minimum (${Utils.formatSatoshi(milestone.solarTransactions.burn.minimumAmount)}).`);
    }
}

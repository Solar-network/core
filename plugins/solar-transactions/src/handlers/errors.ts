import { Errors } from "@arkecosystem/core-transactions";
import { Utils } from "@arkecosystem/crypto";

export class InsufficientBurnAmountError extends Errors.TransactionError {
    public constructor(amount, minimumAmount) {
        super(`Failed to apply transaction, because burn amount (${Utils.formatSatoshi(amount)}) is below the minimum (${Utils.formatSatoshi(minimumAmount)}).`);
    }
}

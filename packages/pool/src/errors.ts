import { Interfaces, Utils } from "@solar-network/crypto";
import { Contracts, Utils as Pool } from "@solar-network/kernel";

export class AlreadyTriedTransactionError extends Contracts.Pool.PoolError {
    public constructor(transaction: Interfaces.ITransaction, seconds: number) {
        super(
            `${transaction} must wait another ${Pool.pluralise("second", seconds, true)} before trying again`,
            "ERR_COOLDOWN",
        );
    }
}

export class RetryTransactionError extends Contracts.Pool.PoolError {
    public constructor(transaction: Interfaces.ITransaction) {
        super(`${transaction} cannot be added to the pool, please retry`, "ERR_RETRY");
    }
}

export class TransactionAlreadyInPoolError extends Contracts.Pool.PoolError {
    public constructor(transaction: Interfaces.ITransaction) {
        super(`${transaction} is already in the pool`, "ERR_DUPLICATE");
    }
}

export class TransactionExceedsMaximumByteSizeError extends Contracts.Pool.PoolError {
    public readonly maxSize: number;

    public constructor(transaction: Interfaces.ITransaction, maxSize: number) {
        super(`${transaction} exceeds the size limit of ${Pool.pluralise("byte", maxSize, true)}`, "ERR_TOO_LARGE");
        this.maxSize = maxSize;
    }
}

export class TransactionHasExpiredError extends Contracts.Pool.PoolError {
    public readonly expirationHeight: number;

    public constructor(transaction: Interfaces.ITransaction, expirationHeight: number) {
        super(`${transaction} expired at height ${expirationHeight}`, "ERR_EXPIRED");
        this.expirationHeight = expirationHeight;
    }
}

export class TransactionFeeTooLowError extends Contracts.Pool.PoolError {
    public constructor(transaction: Interfaces.ITransaction) {
        super(`${transaction} fee is too low to enter the pool`, "ERR_LOW_FEE");
    }
}

export class SenderExceededMaximumTransactionCountError extends Contracts.Pool.PoolError {
    public readonly maxCount: number;

    public constructor(transaction: Interfaces.ITransaction, maxCount: number) {
        super(
            `${transaction} exceeds the sender's ${Pool.pluralise("transaction", maxCount, true)} count limit`,
            "ERR_EXCEEDS_MAX_COUNT",
        );
        this.maxCount = maxCount;
    }
}

export class PoolFullError extends Contracts.Pool.PoolError {
    public readonly required: Utils.BigNumber;

    public constructor(transaction: Interfaces.ITransaction, required: Utils.BigNumber) {
        const msg =
            `${transaction} fee ${Utils.formatSatoshi(transaction.data.fee)} ` +
            `is lower than ${Utils.formatSatoshi(required)} which is already in the pool`;
        super(msg, "ERR_POOL_FULL");
        this.required = required;
    }
}

export class TransactionFailedToApplyError extends Contracts.Pool.PoolError {
    public readonly error: Error;

    public constructor(transaction: Interfaces.ITransaction, error: Error) {
        super(`${transaction} cannot be applied: ${error.message}`, "ERR_APPLY");
        this.error = error;
    }
}

export class TransactionFailedToVerifyError extends Contracts.Pool.PoolError {
    public constructor(transaction: Interfaces.ITransaction) {
        super(`${transaction} failed signature verification check`, "ERR_BAD_DATA");
    }
}

export class TransactionFromWrongNetworkError extends Contracts.Pool.PoolError {
    public currentNetwork: number;

    public constructor(transaction: Interfaces.ITransaction, currentNetwork: number) {
        super(
            `${transaction} network ${transaction.data.network} doesn't match the node's network ${currentNetwork}`,
            "ERR_WRONG_NETWORK",
        );
        this.currentNetwork = currentNetwork;
    }
}

export class InvalidTransactionDataError extends Contracts.Pool.PoolError {
    public constructor(reason: string) {
        super(`Invalid transaction data: ${reason}`, "ERR_BAD_DATA");
    }
}

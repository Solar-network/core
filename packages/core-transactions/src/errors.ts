import { Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { Transactions, Utils } from "@solar-network/crypto";

export class TransactionError extends Error {
    public constructor(message: string) {
        super(message);

        Object.defineProperty(this, "message", {
            enumerable: false,
            value: message,
        });

        Object.defineProperty(this, "name", {
            enumerable: false,
            value: this.constructor.name,
        });

        Error.captureStackTrace(this, this.constructor);
    }
}

export class TransactionFeeTooLowError extends TransactionError {
    public constructor(fee: Utils.BigNumber, expectedFee: Utils.BigNumber) {
        super(`Transaction fee is too low (fee ${Utils.formatSatoshi(fee)} < ${Utils.formatSatoshi(expectedFee)})`);
    }
}

export class InsufficientBurnAmountError extends TransactionError {
    public constructor(amount: Utils.BigNumber, minimumAmount: Utils.BigNumber) {
        super(
            `Failed to apply transaction, because burn amount (${Utils.formatSatoshi(
                amount,
            )}) is below the minimum (${Utils.formatSatoshi(minimumAmount)}).`,
        );
    }
}

export class InvalidTransactionTypeError extends TransactionError {
    public constructor(type: Transactions.InternalTransactionType) {
        super(`Transaction type ${type.toString()} does not exist`);
    }
}

export class DeactivatedTransactionHandlerError extends TransactionError {
    public constructor(type: Transactions.InternalTransactionType) {
        super(`Transaction type ${type.toString()} is deactivated`);
    }
}

export class UnsatisfiedDependencyError extends TransactionError {
    public constructor(type: Transactions.InternalTransactionType) {
        super(`Transaction type ${type.toString()} is missing required dependencies`);
    }
}

export class AlreadyRegisteredError extends TransactionError {
    public constructor(type: Transactions.InternalTransactionType) {
        super(`Transaction type ${type.toString()} is already registered`);
    }
}

export class UnexpectedNonceError extends TransactionError {
    public constructor(txNonce: Utils.BigNumber, sender: Contracts.State.Wallet, reversal: boolean) {
        const action: string = reversal ? "revert" : "apply";
        super(
            `Cannot ${action} a transaction with nonce ${txNonce.toFixed()}: the ` +
                `sender has nonce ${sender.getNonce().toFixed()}`,
        );
    }
}

export class ColdWalletError extends TransactionError {
    public constructor() {
        super("Wallet is not allowed to spend before funding is confirmed");
    }
}

export class InsufficientBalanceError extends TransactionError {
    public constructor(amount: Utils.BigNumber, balance: Utils.BigNumber) {
        super(
            `Insufficient balance in the wallet: tried to send ${Utils.formatSatoshi(
                amount,
            )} but the wallet only has ${Utils.formatSatoshi(balance)} available (${Utils.formatSatoshi(
                balance.minus(amount),
            )})`,
        );
    }
}

export class SenderWalletMismatchError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the public key does not match the wallet");
    }
}

export class UnexpectedSecondSignatureError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet does not have a second signature");
    }
}

export class MissingMultiSignatureOnSenderError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the sender does not have a multisignature");
    }
}

export class InvalidMultiSignaturesError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the multisignatures are invalid");
    }
}

export class InvalidSecondSignatureError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the second signature could not be verified");
    }
}

export class IrrevocableResignationError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet permanently resigned as a delegate");
    }
}

export class WalletAlreadyPermanentlyResignedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already permanently resigned as a delegate");
    }
}

export class WalletAlreadyTemporarilyResignedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already temporarily resigned as a delegate");
    }
}

export class WalletNotADelegateError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet is not a delegate");
    }
}

export class WalletNotResignedError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet has not resigned as a delegate`);
    }
}

export class WalletIsAlreadyDelegateError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already registered as a delegate");
    }
}

export class WalletUsernameAlreadyRegisteredError extends TransactionError {
    public constructor(username: string) {
        super(`Failed to apply transaction, because the delegate name '${username}' is already registered`);
    }
}

export class SecondSignatureAlreadyRegisteredError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because a second signature is already enabled on this wallet");
    }
}
export class NotSupportedForMultiSignatureWalletError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because multisignature is enabled");
    }
}

export class AlreadyVotedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the sender wallet has already voted");
    }
}

export class NoVoteError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet has not voted");
    }
}

export class UnvoteMismatchError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet vote does not match");
    }
}

export class VotedForNonDelegateError extends TransactionError {
    public constructor(vote?: string) {
        if (vote) {
            super(`Failed to apply transaction, because '${vote}' is not a delegate`);
        } else {
            super("Failed to apply transaction, because only delegates can be voted");
        }
    }
}

export class VotedForResignedDelegateError extends TransactionError {
    public constructor(vote: string) {
        super(`Failed to apply transaction, because '${vote}' is a resigned delegate`);
    }
}

export class VotedForTooManyDelegatesError extends TransactionError {
    public constructor(maximumVotes: number) {
        super(`Failed to apply transaction, because there are more than ${maximumVotes.toLocaleString()} votes`);
    }
}

export class NotEnoughDelegatesError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because not enough delegates are registered to allow resignation");
    }
}

export class MultiSignatureAlreadyRegisteredError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because a multisignature is already enabled on this wallet");
    }
}

export class MultiSignatureMinimumKeysError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because too few keys were provided");
    }
}

export class IpfsHashAlreadyExists extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because this IPFS hash is already registered on the blockchain");
    }
}

export class HtlcLockTransactionNotFoundError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the associated HTLC lock transaction could not be found");
    }
}

export class HtlcSecretHashMismatchError extends TransactionError {
    public constructor() {
        super(
            "Failed to apply transaction, because the secret provided does not match the associated HTLC lock transaction secret",
        );
    }
}

export class HtlcLockNotExpiredByEpochTimestampError extends TransactionError {
    public constructor(seconds: number) {
        const hasHave: string = seconds === 1 ? "has" : "have";

        super(
            `Failed to apply transaction, because the associated HTLC lock transaction does not expire until approximately ${AppUtils.pluralise(
                "more second",
                seconds,
                true,
            )} ${hasHave} elapsed`,
        );
    }
}

export class HtlcLockNotExpiredByBlockHeightError extends TransactionError {
    public constructor(blocks: number) {
        const hasHave: string = blocks === 1 ? "has" : "have";

        super(
            `Failed to apply transaction, because the associated HTLC lock transaction does not expire until ${AppUtils.pluralise(
                "more block",
                blocks,
                true,
            )} ${hasHave} been produced`,
        );
    }
}

export class HtlcLockExpiredError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the associated HTLC lock transaction has expired");
    }
}

export class HtlcLockExpiresTooSoonError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the associated HTLC lock transaction expires too soon");
    }
}

export class NotEnoughTimeSinceResignationError extends TransactionError {
    public constructor(blocks: number) {
        super(
            `Failed to apply transaction, because ${AppUtils.pluralise(
                "more block",
                blocks,
                true,
            )} must be produced before the resignation can be revoked`,
        );
    }
}

export class ResignationTypeAssetMilestoneNotActiveError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because different delegate resignation types are not enabled");
    }
}

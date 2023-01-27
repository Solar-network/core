import { Transactions, Utils } from "@solar-network/crypto";
import { Contracts, Utils as AppUtils } from "@solar-network/kernel";

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
    public constructor(type: string) {
        super(`This type of ${type.toString()} transaction is not supported`);
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
            `Insufficient balance in the wallet: tried to spend ${Utils.formatSatoshi(
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

export class UnexpectedExtraSignatureError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet does not have an extra signature");
    }
}

export class InvalidExtraSignatureError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the extra signature could not be verified");
    }
}

export class IrrevocableResignationError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet permanently resigned as a block producer");
    }
}

export class WalletAlreadyPermanentlyResignedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already permanently resigned as a block producer");
    }
}

export class WalletAlreadyTemporarilyResignedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already temporarily resigned as a block producer");
    }
}

export class WalletNotABlockProducerError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet is not a block producer");
    }
}

export class WalletNotResignedError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet has not resigned as a block producer`);
    }
}

export class WalletAlreadyHasUsernameError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet already registered a username");
    }
}

export class WalletUsernameAlreadyRegisteredError extends TransactionError {
    public constructor(username: string) {
        super(`Failed to apply transaction, because the name '${username}' is already registered`);
    }
}

export class ExtraSignatureAlreadyRegisteredError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because an extra signature is already enabled on this wallet");
    }
}

export class PublicKeyAlreadyAssociatedWithWalletError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because that public key is already associated with this wallet");
    }
}

export class AlreadyVotedError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the sender wallet has already voted");
    }
}

export class ZeroPercentVoteError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the minimum amount for each vote is 0.01%");
    }
}

export class UnvoteMismatchError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet vote does not match");
    }
}

export class VotedForNonBlockProducerError extends TransactionError {
    public constructor(vote?: string) {
        if (vote) {
            super(`Failed to apply transaction, because '${vote}' is not a block producer`);
        } else {
            super("Failed to apply transaction, because only block producers can be voted");
        }
    }
}

export class VotedForTooManyBlockProducersError extends TransactionError {
    public constructor(maximumVotes: number) {
        super(`Failed to apply transaction, because there are more than ${maximumVotes.toLocaleString()} votes`);
    }
}

export class NotEnoughBlockProducersError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because not enough block producers are registered to allow resignation");
    }
}

export class IpfsHashAlreadyExists extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because this IPFS hash is already registered on the blockchain");
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

export class UnexpectedHeaderTypeError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the extended transaction header type is not enabled");
    }
}

export class WalletHasNoUsernameError extends TransactionError {
    public constructor() {
        super("Failed to apply transaction, because the wallet does not have a registered username");
    }
}

export class WalletIsAlreadyBlockProducerError extends TransactionError {
    public constructor(username: string) {
        super(`Failed to apply transaction, because '${username}' is already a block producer`);
    }
}

export class BlockProducerSignatureError extends TransactionError {
    public constructor() {
        super(
            "Failed to apply transaction, because the signature for the block producer does not match the public key",
        );
    }
}

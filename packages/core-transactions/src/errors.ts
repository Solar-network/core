import { Contracts } from "@solar-network/core-kernel";
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
        super(`Insufficient balance in database wallet. Wallet is not allowed to spend before funding is confirmed`);
    }
}

export class InsufficientBalanceError extends TransactionError {
    public constructor() {
        super(`Insufficient balance in the wallet`);
    }
}

export class SenderWalletMismatchError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the public key does not match the wallet`);
    }
}

export class UnexpectedSecondSignatureError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because wallet does not allow second signatures`);
    }
}

export class MissingMultiSignatureOnSenderError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because sender does not have a multisignature`);
    }
}

export class InvalidMultiSignaturesError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the multisignatures are invalid`);
    }
}

export class UnsupportedMultiSignatureTransactionError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the transaction does not support multisignatures`);
    }
}

export class InvalidSecondSignatureError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the second signature could not be verified`);
    }
}

export class WalletAlreadyResignedError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet already resigned as delegate`);
    }
}

export class WalletNotADelegateError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet is not a delegate`);
    }
}

export class WalletIsAlreadyDelegateError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet already has a registered username`);
    }
}

export class WalletUsernameAlreadyRegisteredError extends TransactionError {
    public constructor(username: string) {
        super(`Failed to apply transaction, because the username '${username}' is already registered`);
    }
}

export class SecondSignatureAlreadyRegisteredError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because second signature is already enabled`);
    }
}
export class NotSupportedForMultiSignatureWalletError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because multisignature is enabled`);
    }
}

export class SwitchVoteDisabledError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because switch-vote is disabled`);
    }
}

export class AlreadyVotedError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the sender wallet has already voted`);
    }
}

export class NoVoteError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet has not voted`);
    }
}

export class UnvoteMismatchError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the wallet vote does not match`);
    }
}

export class VotedForNonDelegateError extends TransactionError {
    public constructor(vote: string) {
        super(`Failed to apply transaction, because only delegates can be voted`);
    }
}

export class VotedForResignedDelegateError extends TransactionError {
    public constructor(vote: string) {
        super(`Failed to apply transaction, because it votes for a resigned delegate`);
    }
}

export class NotEnoughDelegatesError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because not enough delegates to allow resignation`);
    }
}

export class MultiSignatureAlreadyRegisteredError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because multisignature is already enabled`);
    }
}

export class InvalidMultiSignatureError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the multisignature could not be verified`);
    }
}

export class LegacyMultiSignatureError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because legacy multisignature is no longer supported`);
    }
}

export class LegacyMultiSignatureRegistrationError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because legacy multisignature registrations are no longer supported`);
    }
}

export class MultiSignatureMinimumKeysError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because too few keys were provided`);
    }
}

export class MultiSignatureKeyCountMismatchError extends TransactionError {
    public constructor() {
        super(
            `Failed to apply transaction, because the number of provided keys does not match the number of signatures`,
        );
    }
}

export class IpfsHashAlreadyExists extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because this IPFS hash is already registered on the blockchain`);
    }
}

export class HtlcLockTransactionNotFoundError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the associated HTLC lock transaction could not be found`);
    }
}

export class HtlcSecretHashMismatchError extends TransactionError {
    public constructor() {
        super(
            `Failed to apply transaction, because the secret provided does not match the associated HTLC lock transaction secret`,
        );
    }
}

export class HtlcLockNotExpiredError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the associated HTLC lock transaction did not expire yet`);
    }
}

export class HtlcLockExpiredError extends TransactionError {
    public constructor() {
        super(`Failed to apply transaction, because the associated HTLC lock transaction expired`);
    }
}

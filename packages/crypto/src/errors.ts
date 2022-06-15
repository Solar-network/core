export class CryptoError extends Error {
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

export class NetworkVersionError extends CryptoError {
    public constructor(expected: string | number, given: string | number) {
        super(`Expected version to be ${expected}, but got ${given}`);
    }
}

export class NotImplemented extends CryptoError {
    public constructor() {
        super(`Feature is not available`);
    }
}

export class PrivateKeyLengthError extends CryptoError {
    public constructor(expected: string | number, given: string | number) {
        super(`Expected length to be ${expected}, but got ${given}`);
    }
}

export class PublicKeyError extends CryptoError {
    public constructor(given: string) {
        super(`Expected ${given} to be a valid public key`);
    }
}

export class AddressNetworkError extends CryptoError {
    public constructor(what: string) {
        super(what);
    }
}

export class TransactionTypeError extends CryptoError {
    public constructor(given: string) {
        super(`Type ${given} not supported`);
    }
}

export class InvalidTransactionBytesError extends CryptoError {
    public constructor(message: string) {
        super(`Failed to deserialise transaction, encountered invalid bytes: ${message}`);
    }
}

export class TransactionSchemaError extends CryptoError {
    public constructor(what: string) {
        super(what);
    }
}

export class TransactionVersionError extends CryptoError {
    public constructor(given: number) {
        super(`Version ${given} not supported`);
    }
}

export class UnknownTransactionError extends CryptoError {
    public constructor(given: string) {
        super(`Unknown transaction type: ${given}`);
    }
}

export class TransactionAlreadyRegisteredError extends CryptoError {
    public constructor(name: string) {
        super(`Transaction type ${name} is already registered`);
    }
}

export class TransactionKeyAlreadyRegisteredError extends CryptoError {
    public constructor(name: string) {
        super(`Transaction key ${name} is already registered`);
    }
}

export class CoreTransactionTypeGroupImmutableError extends CryptoError {
    public constructor() {
        super(`The Core transaction type group is immutable`);
    }
}

export class MissingMilestoneFeeError extends CryptoError {
    public constructor(name: string) {
        super(`Missing milestone fee for '${name}'`);
    }
}

export class MaximumTransferCountExceededError extends CryptoError {
    public constructor(limit: number) {
        super(`Number of transfers exceeded the allowed maximum of ${limit}`);
    }
}

export class VendorFieldLengthExceededError extends CryptoError {
    public constructor(limit: number) {
        super(`Length of vendor field exceeded the allowed maximum ${limit}`);
    }
}

export class MissingTransactionSignatureError extends CryptoError {
    public constructor() {
        super(`Expected the transaction to be signed`);
    }
}

export class BlockSchemaError extends CryptoError {
    public constructor(height: number, what: string) {
        super(`Height (${height}): ${what}`);
    }
}

export class InvalidMilestoneConfigurationError extends CryptoError {
    public constructor(message: string) {
        super(message);
    }
}

export class InvalidMultiSignatureAssetError extends CryptoError {
    public constructor() {
        super(`The multisignature asset is invalid`);
    }
}

export class DuplicateParticipantInMultiSignatureError extends CryptoError {
    public constructor() {
        super(`Invalid multisignature, because duplicate participant found`);
    }
}

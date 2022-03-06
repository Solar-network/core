import { Utils } from "@solar-network/crypto";
import { BigNumber } from "@solar-network/utils";

export class ApiCommunicationError extends Error {
    public constructor(network: string) {
        super(`No ${network} api servers responded with valid data`);
    }
}

export class InvalidSignatureError extends Error {
    public constructor() {
        super("The swap transaction signature is invalid");
    }
}

export class TransactionAlreadyCompletedError extends Error {
    public constructor() {
        super("The swap transaction has already been completed");
    }
}

export class TransactionAlreadySubmittedError extends Error {
    public constructor() {
        super("The swap transaction has already been submitted");
    }
}

export class TransactionDoesNotExistError extends Error {
    public constructor() {
        super("The swap transaction does not exist on the other blockchain");
    }
}

export class TransactionNotValidError extends Error {
    public constructor() {
        super("The swap transaction is not valid");
    }
}

export class TransactionHasWrongAmountError extends Error {
    public constructor(amount: BigNumber, expectedAmount: BigNumber) {
        super(
            `The swap transaction has the wrong amount (${Utils.formatSatoshi(amount)}, expected ${Utils.formatSatoshi(expectedAmount)})`
        );
    }
}

export class TransactionHasWrongRecipientError extends Error {
    public constructor(recipient: string, expectedRecipient: string) {
        super(`The swap transaction has the wrong recipient (${recipient}, expected ${expectedRecipient})`);
    }
}

export class TransactionNotYetConfirmedError extends Error {
    public constructor() {
        super("The swap transaction is not yet confirmed");
    }
}

export class TransactionIdInvalidError extends Error {
    public constructor() {
        super("The swap transaction id was not valid");
    }
}

export class TransactionTypeNotPermittedError extends Error {
    public constructor() {
        super("Swap source wallet is restricted to transfer transactions only");
    }
}

export class UnknownSwapNetworkError extends Error {
    public constructor(network: string, supportedNetworks: string[]) {
        super(
            `The network of this swap transaction (${network}) does not correspond to any recognised network (${supportedNetworks.join(", ")})`
        );
    }
}

export class VendorFieldIncorrectError extends Error {
    public constructor() {
        super("The vendor field of the transaction from the swap source wallet must adhere to the correct format");
    }
}

export class WrongChainError extends Error {
    public constructor(id: string, expectedId: string) {
        super(`The swap transaction has the wrong chain id (${id}, expected ${expectedId})`);
    }
}

export class WrongContractError extends Error {
    public constructor() {
        super("The swap transaction was sent to the wrong contract");
    }
}

export class WrongTokenError extends Error {
    public constructor() {
        super("The swap transaction was not for the SXP token");
    }
}

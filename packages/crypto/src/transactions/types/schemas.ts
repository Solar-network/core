import deepmerge from "deepmerge";

import { TransactionType } from "../../enums";
import { configManager } from "../../managers";

const maxDelegates = configManager
    .getMilestones()
    .reduce((acc: number, curr: { activeDelegates: number }) => Math.max(acc, curr.activeDelegates), 0);

const signedTransaction = {
    anyOf: [
        { required: ["id", "signature"] },
        { required: ["id", "signature", "signatures"] },
        { required: ["id", "signatures"] },
    ],
};

const strictTransaction = {
    additionalProperties: false,
};

export const transactionBaseSchema: Record<string, any> = {
    $id: undefined,
    type: "object",
    required: ["type", "senderPublicKey", "fee", "amount", "nonce"],
    properties: {
        id: { anyOf: [{ $ref: "transactionId" }, { type: "null" }] },
        version: { enum: [2, 3] },
        network: { $ref: "networkByte" },
        nonce: { bignumber: { minimum: 0 } },
        typeGroup: { type: "integer", minimum: 0 },
        amount: { bignumber: { minimum: 1, bypassGenesis: true } },
        fee: { bignumber: { minimum: 0, bypassGenesis: true } },
        burnedFee: { bignumber: { minimum: 0 } },
        senderPublicKey: { $ref: "publicKey" },
        vendorField: { anyOf: [{ type: "null" }, { type: "string", format: "vendorField" }] },
        signature: { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
        secondSignature: { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
        signSignature: { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
        signatures: {
            type: "array",
            minItems: 1,
            maxItems: 16,
            additionalItems: false,
            uniqueItems: true,
            items: { allOf: [{ minLength: 130, maxLength: 130 }, { $ref: "hex" }] },
        },
    },
};

export const extend = (parent: object, properties: object): TransactionSchema => {
    return deepmerge(parent, properties);
};

export const signedSchema = (schema: TransactionSchema): TransactionSchema => {
    const signed = extend(schema, signedTransaction);
    signed.$id = `${schema.$id}Signed`;
    return signed;
};

export const strictSchema = (schema: TransactionSchema): TransactionSchema => {
    const signed = signedSchema(schema);
    const strict = extend(signed, strictTransaction);
    strict.$id = `${schema.$id}Strict`;
    return strict;
};

export const transfer = extend(transactionBaseSchema, {
    $id: "transfer",
    required: ["recipientId"],
    properties: {
        type: { transactionType: TransactionType.Core.Transfer },
        fee: { bignumber: { minimum: 1, bypassGenesis: true } },
        recipientId: { $ref: "address" },
        expiration: { type: "integer", minimum: 0 },
    },
});

export const secondSignature = extend(transactionBaseSchema, {
    $id: "secondSignature",
    required: ["asset"],
    properties: {
        type: { transactionType: TransactionType.Core.SecondSignature },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        secondSignature: { type: "null" },
        asset: {
            type: "object",
            required: ["signature"],
            properties: {
                signature: {
                    type: "object",
                    required: ["publicKey"],
                    properties: {
                        publicKey: {
                            $ref: "publicKey",
                        },
                    },
                },
            },
        },
    },
});

export const delegateRegistration = extend(transactionBaseSchema, {
    $id: "delegateRegistration",
    required: ["asset"],
    properties: {
        type: { transactionType: TransactionType.Core.DelegateRegistration },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1, bypassGenesis: true } },
        asset: {
            type: "object",
            required: ["delegate"],
            properties: {
                delegate: {
                    type: "object",
                    required: ["username"],
                    properties: {
                        username: { $ref: "delegateUsername" },
                    },
                },
            },
        },
    },
});

export const legacyVote = extend(transactionBaseSchema, {
    $id: "legacyVote",
    required: ["asset"],
    if: { properties: { version: { anyOf: [{ const: 2 }] } } },
    then: {
        properties: {
            asset: {
                properties: { votes: { items: { $ref: "walletVoteUsernameOrPublicKey" } } },
            },
        },
    },
    else: {
        properties: {
            asset: {
                properties: { votes: { items: { $ref: "walletVoteUsername" } } },
            },
        },
    },
    properties: {
        type: { transactionType: TransactionType.Core.Vote },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        recipientId: { $ref: "address" },
        asset: {
            type: "object",
            required: ["votes"],
            properties: {
                votes: {
                    type: "array",
                    minItems: 1,
                    maxItems: 2,
                    additionalItems: false,
                },
            },
        },
    },
});

export const vote = extend(transactionBaseSchema, {
    $id: "vote",
    required: ["typeGroup", "asset"],
    properties: {
        type: { transactionType: TransactionType.Solar.Vote },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["votes"],
            properties: {
                votes: {
                    patternProperties: {
                        "^[a-z0-9!@$&_.]{1,20}$": {
                            type: "number",
                            multipleOf: 0.01,
                            minimum: 0.01,
                            maximum: 100,
                        },
                    },
                    additionalProperties: false,
                    maxProperties: maxDelegates,
                    sumOfVotesEquals100: true,
                },
                additionalProperties: false,
            },
        },
    },
});

export const multiSignature = extend(transactionBaseSchema, {
    $id: "multiSignature",
    required: ["asset"],
    properties: {
        type: { transactionType: TransactionType.Core.MultiSignature },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["multiSignature"],
            properties: {
                multiSignature: {
                    type: "object",
                    required: ["min", "publicKeys"],
                    properties: {
                        min: {
                            type: "integer",
                            minimum: 1,
                            maximum: { $data: "1/publicKeys/length" },
                        },
                        publicKeys: {
                            type: "array",
                            minItems: 1,
                            maxItems: 16,
                            additionalItems: false,
                            uniqueItems: true,
                            items: { $ref: "publicKey" },
                        },
                    },
                },
            },
        },
    },
});

export const ipfs = extend(transactionBaseSchema, {
    $id: "ipfs",
    properties: {
        type: { transactionType: TransactionType.Core.Ipfs },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["ipfs"],
            properties: {
                ipfs: {
                    allOf: [{ minLength: 2, maxLength: 90 }, { $ref: "base58" }],
                    // ipfs hash has varying length but we set max limit to twice the length of base58 ipfs sha-256 hash
                },
            },
        },
    },
});

export const htlcLock = extend(transactionBaseSchema, {
    $id: "htlcLock",
    required: ["recipientId"],
    properties: {
        type: { transactionType: TransactionType.Core.HtlcLock },
        amount: { bignumber: { minimum: 1 } },
        fee: { bignumber: { minimum: 1 } },
        recipientId: { $ref: "address" },
        asset: {
            type: "object",
            required: ["lock"],
            properties: {
                lock: {
                    type: "object",
                    required: ["secretHash", "expiration"],
                    properties: {
                        secretHash: {
                            oneOf: [
                                { allOf: [{ minLength: 64, maxLength: 64 }, { $ref: "hex" }] },
                                { allOf: [{ minLength: 96, maxLength: 96 }, { $ref: "hex" }] },
                                { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
                            ],
                        },
                        expiration: {
                            type: "object",
                            required: ["type", "value"],
                            properties: {
                                type: { enum: [1, 2] },
                                value: { type: "integer", minimum: 0 },
                            },
                        },
                    },
                },
            },
        },
    },
});

export const htlcClaim = extend(transactionBaseSchema, {
    $id: "htlcClaim",
    properties: {
        type: { transactionType: TransactionType.Core.HtlcClaim },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 0 } },
        asset: {
            type: "object",
            required: ["claim"],
            properties: {
                claim: {
                    type: "object",
                    required: ["lockTransactionId", "unlockSecret"],
                    properties: {
                        hashType: { enum: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
                        lockTransactionId: { $ref: "transactionId" },
                        unlockSecret: {
                            oneOf: [
                                { allOf: [{ minLength: 64, maxLength: 64 }, { $ref: "hex" }] },
                                { allOf: [{ minLength: 96, maxLength: 96 }, { $ref: "hex" }] },
                                { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
                            ],
                        },
                    },
                },
            },
        },
    },
});

export const htlcRefund = extend(transactionBaseSchema, {
    $id: "htlcRefund",
    properties: {
        type: { transactionType: TransactionType.Core.HtlcRefund },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 0 } },
        asset: {
            type: "object",
            required: ["refund"],
            properties: {
                refund: {
                    type: "object",
                    required: ["lockTransactionId"],
                    properties: {
                        lockTransactionId: { $ref: "transactionId" },
                    },
                },
            },
        },
    },
});

export const multiPayment = extend(transactionBaseSchema, {
    $id: "multiPayment",
    properties: {
        type: { transactionType: TransactionType.Core.MultiPayment },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["payments"],
            properties: {
                payments: {
                    type: "array",
                    minItems: 2,
                    additionalItems: false,
                    uniqueItems: false,
                    items: {
                        type: "object",
                        required: ["amount", "recipientId"],
                        properties: {
                            amount: { bignumber: { minimum: 1 } },
                            recipientId: { $ref: "address" },
                        },
                    },
                },
            },
        },
    },
});

export const delegateResignation = extend(transactionBaseSchema, {
    $id: "delegateResignation",
    properties: {
        type: { transactionType: TransactionType.Core.DelegateResignation },
        amount: { bignumber: { minimum: 0, maximum: 0 } },
        fee: { bignumber: { minimum: 0 } },
    },
});

export type TransactionSchema = typeof transactionBaseSchema;

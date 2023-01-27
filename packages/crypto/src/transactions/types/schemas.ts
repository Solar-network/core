import deepmerge from "deepmerge";

import { TransactionType } from "../../enums";
import { configManager } from "../../managers";

const signedTransaction = {
    required: ["id", "signatures"],
};

const strictTransaction = {
    additionalProperties: false,
};

export const transactionBaseSchema: Record<string, any> = {
    $id: undefined,
    type: "object",
    required: ["type", "senderPublicKey", "fee", "nonce"],
    properties: {
        burnedFee: { bignumber: { minimum: 0 } },
        fee: { bignumber: { minimum: 0, bypassGenesis: true } },
        headerType: { enum: [0, 1] },
        id: { anyOf: [{ $ref: "transactionId" }, { type: "null" }] },
        memo: { anyOf: [{ type: "null" }, { type: "string", format: "memo" }] },
        network: { $ref: "networkByte" },
        nonce: { bignumber: { minimum: 0 } },
        senderId: { $ref: "address" },
        senderPublicKey: { $ref: "publicKey" },
        signatures: {
            type: "object",
            required: ["primary"],
            properties: {
                primary: {
                    allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }],
                },
                extra: {
                    allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }],
                },
            },
            additionalItems: false,
            uniqueItems: true,
        },
        type: { enum: Object.keys(TransactionType) },
        version: { enum: [2, 3] },
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

export const extraSignature = extend(transactionBaseSchema, {
    $id: "extraSignature",
    required: ["asset"],
    properties: {
        fee: { bignumber: { minimum: 1 } },
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

export const registration = extend(transactionBaseSchema, {
    $id: "registration",
    required: ["asset"],
    properties: {
        fee: { bignumber: { minimum: 1, bypassGenesis: true } },
        asset: {
            type: "object",
            required: ["registration"],
            properties: {
                registration: {
                    type: "object",
                    required: ["username"],
                    properties: {
                        username: { $ref: "username" },
                    },
                },
            },
        },
    },
});

export const vote = extend(transactionBaseSchema, {
    $id: "vote",
    required: ["asset"],
    properties: {
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["votes"],
            properties: {
                votes: {
                    patternProperties: {
                        "^((?!_)(?=.*[a-z!@$&_.])([a-z0-9!@$&_.]?){1,20})$|^(02|03)[0-9a-f]{64}$": {
                            type: "number",
                            multipleOf: 0.01,
                            minimum: 0,
                            maximum: 100,
                        },
                    },
                    additionalProperties: false,
                    allOrNothing: true,
                },
                additionalProperties: false,
            },
        },
    },
});

export const ipfs = extend(transactionBaseSchema, {
    $id: "ipfs",
    required: ["asset"],
    properties: {
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["ipfs"],
            properties: {
                ipfs: {
                    type: "object",
                    required: ["hash"],
                    properties: {
                        hash: {
                            allOf: [{ minLength: 2, maxLength: 90 }, { $ref: "base58" }],
                        },
                    },
                },
            },
        },
    },
});

export const transfer = extend(transactionBaseSchema, {
    $id: "transfer",
    required: ["asset"],
    properties: {
        expiration: { type: "integer", minimum: 0 },
        fee: { bignumber: { minimum: 1 } },
        asset: {
            type: "object",
            required: ["recipients"],
            properties: {
                recipients: {
                    type: "array",
                    minItems: 1,
                    maxItems: configManager.getMilestone().transfer.maximumRecipients,
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

export const resignation = extend(transactionBaseSchema, {
    $id: "resignation",
    properties: {
        fee: { bignumber: { minimum: 0 } },
        asset: {
            type: "object",
            required: ["resignation"],
            properties: {
                resignation: {
                    type: "object",
                    required: ["type"],
                    properties: {
                        type: { enum: [0, 1, 2] },
                    },
                },
            },
        },
    },
});

export const burn = extend(transactionBaseSchema, {
    $id: "burn",
    required: ["asset"],
    properties: {
        asset: {
            type: "object",
            required: ["burn"],
            properties: {
                burn: {
                    type: "object",
                    required: ["amount"],
                    properties: {
                        amount: { bignumber: { minimum: 1 } },
                    },
                },
            },
        },
    },
});

export type TransactionSchema = typeof transactionBaseSchema;

export const schemas = {
    hex: {
        $id: "hex",
        type: "string",
        pattern: "^[0123456789A-Fa-f]+$",
    },

    base58: {
        $id: "base58",
        type: "string",
        pattern: "^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$",
    },

    alphanumeric: {
        $id: "alphanumeric",
        type: "string",
        pattern: "^[a-zA-Z0-9]+$",
    },

    transactionId: {
        $id: "transactionId",
        allOf: [{ minLength: 64, maxLength: 64 }, { $ref: "hex" }],
    },

    networkByte: {
        $id: "networkByte",
        network: true,
    },

    address: {
        $id: "address",
        allOf: [{ minLength: 34, maxLength: 34 }, { $ref: "base58" }],
    },

    publicKey: {
        $id: "publicKey",
        allOf: [{ minLength: 66, maxLength: 66 }, { $ref: "hex" }, { transform: ["toLowerCase"] }],
    },

    walletVotePublicKey: {
        $id: "walletVotePublicKey",
        allOf: [
            { type: "string", pattern: "^[+|-][a-f0-9]{66}$" },
            { minLength: 67, maxLength: 67 },
        ],
    },

    walletVoteUsername: {
        $id: "walletVoteUsername",
        allOf: [
            { type: "string", pattern: "^[+|-][a-z0-9!@$&_.]+$" },
            { minLength: 2, maxLength: 21 },
        ],
    },

    walletVoteUsernameOrPublicKey: {
        $id: "walletVoteUsernameOrPublicKey",
        oneOf: [{ $ref: "walletVoteUsername" }, { $ref: "walletVotePublicKey" }],
    },

    username: {
        $id: "delegateUsername",
        allOf: [
            { type: "string", pattern: "^[a-z0-9!@$&_.]+$" },
            { minLength: 1, maxLength: 20 },
        ],
    },

    genericName: {
        $id: "genericName",
        allOf: [
            { type: "string", pattern: "^[a-zA-Z0-9]+(( - |[ ._-])[a-zA-Z0-9]+)*[.]?$" },
            { minLength: 1, maxLength: 40 },
        ],
    },

    uri: {
        $id: "uri",
        allOf: [{ format: "uri" }, { minLength: 4, maxLength: 80 }],
    },

    blockHeader: {
        $id: "blockHeader",
        type: "object",
        required: [
            "id",
            "timestamp",
            "previousBlock",
            "height",
            "totalAmount",
            "totalFee",
            "reward",
            "generatorPublicKey",
            "blockSignature",
        ],
        properties: {
            id: { blockId: {} },
            version: { type: "integer", minimum: 0 },
            timestamp: { type: "integer", minimum: 0 },
            previousBlock: { blockId: { allowNullWhenGenesis: true, isPreviousBlock: true } },
            height: { type: "integer", minimum: 1 },
            numberOfTransactions: { type: "integer" },
            totalAmount: { bignumber: { minimum: 0, bypassGenesis: true, block: true } },
            totalFee: { bignumber: { minimum: 0, bypassGenesis: true, block: true } },
            reward: { bignumber: { minimum: 0 } },
            payloadLength: { type: "integer", minimum: 0 },
            payloadHash: { $ref: "hex" },
            generatorPublicKey: { $ref: "publicKey" },
            blockSignature: { allOf: [{ minLength: 128, maxLength: 128 }, { $ref: "hex" }] },
        },
    },

    block: {
        $id: "block",
        $ref: "blockHeader",
        properties: {
            transactions: {
                $ref: "transactions",
                minItems: { $data: "1/numberOfTransactions" },
                maxItems: { $data: "1/numberOfTransactions" },
            },
        },
    },
};

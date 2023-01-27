import { Managers } from "@solar-network/crypto";

import { constants } from "./constants";

const maxBlockProducers = Managers.configManager
    .getMilestones()
    .reduce((acc, curr) => Math.max(acc, curr.activeBlockProducers), 0);

const maxTransactions = Managers.configManager
    .getMilestones()
    .reduce((acc, curr) => Math.max(acc, curr.block.maxTransactions), 0);

export const replySchemas = {
    "p2p.peer.getCommonBlocks": {
        type: "object",
        additionalProperties: false,
        properties: {
            common: {
                anyOf: [
                    {
                        type: "object",
                        properties: {
                            height: {
                                type: "integer",
                                minimum: 1,
                            },
                            id: { blockId: {} },
                        },
                        required: ["height", "id"],
                    },
                    {
                        type: "null",
                    },
                ],
            },
        },
        required: ["common"],
    },
    "p2p.peer.getPeers": {
        type: "array",
        maxItems: constants.MAX_PEERS_GETPEERS,
        items: {
            type: "object",
            properties: {
                ip: {
                    anyOf: [
                        {
                            type: "string",
                            format: "ipv4",
                        },
                        {
                            type: "string",
                            format: "ipv6",
                        },
                    ],
                },
                port: {
                    type: "integer",
                    minimum: 0,
                    maximum: 65535,
                },
            },
            required: ["ip", "port"],
        },
    },
    "p2p.peer.getStatus": {
        type: "object",
        required: ["state", "config", "signatures"],
        additionalProperties: false,
        properties: {
            state: {
                type: "object",
                required: ["height", "allowed", "currentSlot", "header"],
                properties: {
                    height: {
                        type: "integer",
                        minimum: 1,
                    },
                    allowed: {
                        type: "boolean",
                    },
                    currentSlot: {
                        type: "integer",
                        minimum: 0,
                    },
                    header: {
                        anyOf: [
                            {
                                $ref: "blockHeader",
                            },
                            {
                                type: "object",
                                minProperties: 0,
                                maxProperties: 0,
                            },
                        ],
                    },
                },
            },
            config: {
                type: "object",
                required: ["version", "network", "plugins"],
                additionalProperties: false,
                properties: {
                    version: {
                        type: "string",
                        minLength: 5,
                        maxLength: 24,
                    },
                    network: {
                        type: "object",
                        required: ["name", "nethash"],
                        additionalProperties: false,
                        properties: {
                            name: {
                                type: "string",
                                minLength: 1,
                                maxLength: 20,
                            },
                            version: {
                                type: "integer",
                                minimum: 0,
                                maximum: 255,
                            },
                            nethash: {
                                allOf: [
                                    {
                                        $ref: "hex",
                                    },
                                    {
                                        minLength: 64,
                                        maxLength: 64,
                                    },
                                ],
                            },
                        },
                    },
                    plugins: {
                        type: "object",
                        maxProperties: 32,
                        minProperties: 0,
                        additionalProperties: false,
                        patternProperties: {
                            "^.{4,64}$": {
                                type: "object",
                                required: ["port", "enabled"],
                                additionalProperties: false,
                                properties: {
                                    port: {
                                        type: "integer",
                                        minimum: 0,
                                        maximum: 65535,
                                    },
                                    enabled: {
                                        type: "boolean",
                                    },
                                },
                            },
                        },
                    },
                },
            },
            publicKeys: {
                type: "array",
                maxItems: maxBlockProducers,
                items: {
                    allOf: [
                        {
                            $ref: "hex",
                        },
                        {
                            minLength: 66,
                            maxLength: 66,
                        },
                    ],
                },
            },
            signatures: {
                type: "array",
                maxItems: maxBlockProducers,
                items: {
                    allOf: [
                        {
                            $ref: "hex",
                        },
                        {
                            minLength: 128,
                            maxLength: 128,
                        },
                    ],
                },
            },
        },
    },
    "p2p.blocks.getBlocks": {
        type: "array",
        maxItems: 400,
        items: {
            $ref: "blockHeader",
        },
    },
    "p2p.blocks.postBlock": {
        type: "object",
        additionalProperties: false,
        properties: {
            status: { type: "boolean" },
            height: { type: "integer", minimum: 1 },
        },
    },
    "p2p.transactions.getUnconfirmedTransactions": {
        type: "object",
        additionalProperties: false,
        properties: {
            poolSize: { type: "integer", minimum: 0 },
            transactions: { type: "array", maxItems: maxTransactions },
        },
    },
    "p2p.transactions.postTransactions": {
        type: "array",
    },
};

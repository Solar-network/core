import { Ajv } from "ajv";
import ajvKeywords from "ajv-keywords";

import { TransactionType, TransactionTypeGroup } from "../enums";
import { ITransactionData } from "../interfaces";
import { configManager } from "../managers";
import { BigNumber, isGenesisTransaction } from "../utils";

const maxBytes = (ajv: Ajv): void => {
    ajv.addKeyword("maxBytes", {
        type: "string",
        compile(schema, parentSchema) {
            return (data) => {
                if ((parentSchema as any).type !== "string") {
                    return false;
                }

                return Buffer.from(data, "utf8").byteLength <= schema;
            };
        },
        errors: false,
        metaSchema: {
            type: "integer",
            minimum: 0,
        },
    });
};

const transactionType = (ajv: Ajv): void => {
    ajv.addKeyword("transactionType", {
        compile(schema) {
            return (data, _, po: object | any[] | undefined) => {
                const parentObject: ITransactionData = po as unknown as ITransactionData;
                if (
                    data === TransactionType.Core.Transfer &&
                    parentObject &&
                    (!parentObject.typeGroup || parentObject.typeGroup === TransactionTypeGroup.Core)
                ) {
                    if (parentObject.asset && parentObject.asset.recipients) {
                        return (
                            parentObject.asset.recipients.length >= 1 &&
                            parentObject.asset.recipients.length <=
                                configManager.getMilestone().transfer.maximumRecipients
                        );
                    }
                }

                return data === schema;
            };
        },
        errors: false,
        metaSchema: {
            type: "integer",
            minimum: 0,
        },
    });
};

const network = (ajv: Ajv): void => {
    ajv.addKeyword("network", {
        compile(schema) {
            return (data) => {
                return schema && data === configManager.get("network.pubKeyHash");
            };
        },
        errors: false,
        metaSchema: {
            type: "boolean",
        },
    });
};

const bignumber = (ajv: Ajv): void => {
    const instanceOf = ajvKeywords.get("instanceof").definition;
    instanceOf.CONSTRUCTORS.BigNumber = BigNumber;

    ajv.addKeyword("bignumber", {
        compile(schema) {
            return (data, dataPath, parentObject: any, property) => {
                const minimum = typeof schema.minimum !== "undefined" ? schema.minimum : 0;
                const maximum = typeof schema.maximum !== "undefined" ? schema.maximum : "9223372036854775807"; // 8 byte maximum

                if (data !== 0 && !data) {
                    return false;
                }

                let bignum: BigNumber;
                try {
                    bignum = BigNumber.make(data);
                } catch {
                    return false;
                }

                if (parentObject && property) {
                    parentObject[property] = bignum;
                }

                let bypassGenesis: boolean = false;
                if (schema.bypassGenesis) {
                    if (parentObject.id) {
                        if (schema.block) {
                            bypassGenesis = parentObject.height === 1;
                        } else {
                            bypassGenesis = isGenesisTransaction(parentObject.id);
                        }
                    }
                }

                if (bignum.isLessThan(minimum) && !(bignum.isZero() && bypassGenesis)) {
                    return false;
                }

                if (bignum.isGreaterThan(maximum) && !bypassGenesis) {
                    return false;
                }

                return true;
            };
        },
        errors: false,
        modifying: true,
        metaSchema: {
            type: "object",
            properties: {
                minimum: { type: "integer" },
                maximum: { type: "integer" },
                bypassGenesis: { type: "boolean" },
                block: { type: "boolean" },
            },
            additionalItems: false,
        },
    });
};

const blockId = (ajv: Ajv): void => {
    ajv.addKeyword("blockId", {
        compile(schema) {
            return (data, dataPath, parentObject: any) => {
                if (parentObject && parentObject.height === 1 && schema.allowNullWhenGenesis) {
                    if (!data || Number(data) === 0) {
                        return true;
                    }
                }

                if (typeof data !== "string") {
                    return false;
                }

                return /^[0-9a-f]{64}$/i.test(data);
            };
        },
        errors: false,
        metaSchema: {
            type: "object",
            properties: {
                allowNullWhenGenesis: { type: "boolean" },
                isPreviousBlock: { type: "boolean" },
            },
            additionalItems: false,
        },
    });
};

export const keywords = [bignumber, blockId, maxBytes, network, transactionType];

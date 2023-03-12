import { Enums, Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";
import Joi from "joi";

import * as Schemas from "../schemas";

export type WalletCriteria = Contracts.Search.StandardCriteriaOf<WalletResource>;

export type WalletSearchResource = {
    address: string;
    publicKeys?: Record<string, string | Contracts.State.WalletPermissions>;
    balance: Utils.BigNumber;
    votes: object;
};

export type WalletResource = {
    address: string;
    publicKeys?: Record<string, string | Contracts.State.WalletPermissions>;
    balance: Utils.BigNumber;
    rank?: number;
    nonce: Utils.BigNumber;
    attributes: object;
    transactions: Contracts.State.WalletTransactions;
    votingFor: Record<string, Contracts.State.WalletVoteDistribution>;
};

const walletAddressSchema = Joi.string().alphanum().length(34);
const walletPublicKeySchema = Joi.string().hex().length(66);
const walletUsernameSchema = Joi.string().pattern(/^[a-z0-9!@$&_.]{1,20}$/);

const numericCriteria = (value: any) =>
    Joi.alternatives().try(
        value,
        Joi.object().keys({ from: value }),
        Joi.object().keys({ to: value }),
        Joi.object().keys({ from: value, to: value }),
    );
const orCriteria = (criteria: any) => Joi.alternatives().try(criteria);
const orNumericCriteria = (value: any) => orCriteria(numericCriteria(value));

export const walletCriteriaSchemaObject = {
    address: Joi.alternatives(
        walletAddressSchema,
        Joi.string()
            .regex(/^[0-9A-Za-z%]{1,34}$/)
            .regex(/%/),
    ),
    publicKey: Joi.alternatives(
        walletPublicKeySchema,
        Joi.string()
            .regex(/^[0-9a-z%]{1,66}$/)
            .regex(/%/),
    ),
    balance: Schemas.createRangeCriteriaSchema(Schemas.bigNumber),
    rank: Joi.number().integer().positive(),
    nonce: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    attributes: Joi.object(),
    username: Joi.string().pattern(/^[a-z0-9!@$&_.]{1,20}$/),
    transactions: {
        received: {
            total: orNumericCriteria(Joi.number().integer().min(0)),
            types: {},
        },
        sent: {
            total: orNumericCriteria(Joi.number().integer().min(0)),
            types: {},
        },
    },
};

for (const type of Object.keys(Enums.TransactionType)) {
    for (const action of ["received", "sent"]) {
        walletCriteriaSchemaObject.transactions[action].types[type] = {
            count: orNumericCriteria(Joi.number().integer().min(0)),
            first: {
                id: Joi.string().hex().length(64),
                timestamp: {
                    epoch: orNumericCriteria(Joi.number().integer().min(0)),
                    unix: orNumericCriteria(Joi.number().integer().min(0)),
                },
            },
            last: {
                id: Joi.string().hex().length(64),
                timestamp: {
                    epoch: orNumericCriteria(Joi.number().integer().min(0)),
                    unix: orNumericCriteria(Joi.number().integer().min(0)),
                },
            },
        };
    }
}

export const walletParamSchema = Joi.alternatives(walletAddressSchema, walletPublicKeySchema, walletUsernameSchema);
export const walletCriteriaSchema = Schemas.createCriteriaSchema(walletCriteriaSchemaObject);
export const walletSortingSchema = Schemas.createSortingSchema(walletCriteriaSchemaObject, ["attributes"]);

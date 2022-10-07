import { Utils } from "@solar-network/crypto";
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
    nonce: Utils.BigNumber;
    attributes: object;
    votingFor: object;
};

const walletAddressSchema = Joi.string().alphanum().length(34);
const walletPublicKeySchema = Joi.string().hex().length(66);
const walletUsernameSchema = Joi.string().pattern(/^[a-z0-9!@$&_.]{1,20}$/);

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
    nonce: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    attributes: Joi.object(),
    username: Joi.string().pattern(/^[a-z0-9!@$&_.]{1,20}$/),
};

export const walletParamSchema = Joi.alternatives(walletAddressSchema, walletPublicKeySchema, walletUsernameSchema);
export const walletCriteriaSchema = Schemas.createCriteriaSchema(walletCriteriaSchemaObject);
export const walletSortingSchema = Schemas.createSortingSchema(walletCriteriaSchemaObject, ["attributes"]);

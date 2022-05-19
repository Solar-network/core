import { Contracts } from "@solar-network/core-kernel";
import { Utils } from "@solar-network/crypto";
import { Semver } from "@solar-network/utils";
import Joi from "joi";

import * as Schemas from "../schemas";
import { blockCriteriaSchemaObject } from "./block";
import { walletCriteriaSchemaObject } from "./wallet";

export type DelegateCriteria = Contracts.Search.StandardCriteriaOf<DelegateResource>;

export type DelegateResource = {
    username: string;
    address: string;
    publicKey: string;
    votes: Utils.BigNumber;
    voters: number;
    rank: number;
    isResigned: boolean;
    blocks: {
        produced: number;
        last: string | undefined;
    };
    production: {
        approval: number;
    };
    forged: {
        fees: Utils.BigNumber;
        burnedFees: Utils.BigNumber;
        rewards: Utils.BigNumber;
        devFunds: Utils.BigNumber;
        total: Utils.BigNumber;
    };
    version?: Semver;
};

export const delegateCriteriaSchemaObject = {
    username: Joi.string().pattern(/^[a-z0-9!@$&_.]{1,20}$/),
    address: walletCriteriaSchemaObject.address,
    publicKey: walletCriteriaSchemaObject.publicKey,
    votes: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    voters: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
    rank: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(1)),
    isResigned: Joi.boolean(),
    blocks: {
        produced: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
        last: {
            id: blockCriteriaSchemaObject.id,
            height: blockCriteriaSchemaObject.height,
            timestamp: {
                epoch: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
                unix: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
                human: Joi.string(),
            },
        },
    },
    production: {
        approval: Schemas.createRangeCriteriaSchema(Joi.number().min(0)),
    },
    forged: {
        burnedFees: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        fees: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        rewards: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        devFunds: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        total: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    },
    version: Schemas.createRangeCriteriaSchema(Schemas.semver),
};

export const delegateCriteriaSchema = Schemas.createCriteriaSchema(delegateCriteriaSchemaObject);
export const delegateSortingSchema = Schemas.createSortingSchema(delegateCriteriaSchemaObject);

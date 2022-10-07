import { Utils } from "@solar-network/crypto";
import { Contracts, Utils as AppUtils } from "@solar-network/kernel";
import Joi from "joi";

import * as Schemas from "../schemas";
import { blockCriteriaSchemaObject } from "./block";
import { walletCriteriaSchemaObject } from "./wallet";

export type DelegateCriteria = Contracts.Search.StandardCriteriaOf<DelegateResource>;

export type DelegateResource = {
    username: string;
    address: string;
    publicKey: string;
    votesReceived: {
        percent: number;
        votes: Utils.BigNumber;
        voters: number;
    };
    rank: number;
    isResigned: boolean;
    resignation: string | undefined;
    blocks: {
        produced: number;
        missed: number | undefined;
        productivity: number | undefined;
        last: string | undefined;
    };
    forged: {
        fees: Utils.BigNumber;
        burnedFees: Utils.BigNumber;
        rewards: Utils.BigNumber;
        donations: Utils.BigNumber;
        total: Utils.BigNumber;
    };
    version?: AppUtils.Semver;
};

export const delegateCriteriaSchemaObject = {
    username: walletCriteriaSchemaObject.username,
    address: walletCriteriaSchemaObject.address,
    publicKey: walletCriteriaSchemaObject.publicKey,
    votesReceived: {
        percent: Schemas.createRangeCriteriaSchema(Joi.number().min(0).max(100)),
        votes: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        voters: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
    },
    rank: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(1)),
    isResigned: Joi.boolean(),
    resignation: Joi.string().valid("permanent", "temporary"),
    blocks: {
        produced: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
        missed: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
        productivity: Schemas.createRangeCriteriaSchema(Joi.number().min(0)),
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
    forged: {
        burnedFees: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        fees: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        rewards: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        donations: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        total: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    },
    version: Schemas.createRangeCriteriaSchema(Schemas.semver),
};

export const delegateCriteriaSchema = Schemas.createCriteriaSchema(delegateCriteriaSchemaObject);
export const delegateSortingSchema = Schemas.createSortingSchema(delegateCriteriaSchemaObject);

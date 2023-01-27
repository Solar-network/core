import { Utils } from "@solar-network/crypto";
import { Contracts, Utils as AppUtils } from "@solar-network/kernel";
import Joi from "joi";

import * as Schemas from "../schemas";
import { blockCriteriaSchemaObject } from "./block";
import { walletCriteriaSchemaObject } from "./wallet";

export type BlockProducerCriteria = Contracts.Search.StandardCriteriaOf<BlockProducerResource>;

export type BlockProducerResource = {
    username: string;
    address: string;
    publicKey: string;
    votesReceived: {
        percent: number;
        votes: Utils.BigNumber;
        voters: number;
    };
    rank: number;
    resignation: string | undefined;
    blocks: {
        produced: number;
        failed: number | undefined;
        reliability: number | undefined;
        last: string | undefined;
    };
    collected: {
        fees: {
            burned: Utils.BigNumber;
            retained: Utils.BigNumber;
            total: Utils.BigNumber;
        };
        rewards: Utils.BigNumber;
        donations: Utils.BigNumber;
        total: Utils.BigNumber;
    };
    version?: AppUtils.Semver;
};

export const blockProducerCriteriaSchemaObject = {
    username: walletCriteriaSchemaObject.username,
    address: walletCriteriaSchemaObject.address,
    publicKey: walletCriteriaSchemaObject.publicKey,
    votesReceived: {
        percent: Schemas.createRangeCriteriaSchema(Joi.number().min(0).max(100)),
        votes: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        voters: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
    },
    rank: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(1)),
    resignation: Joi.string().valid("permanent", "temporary"),
    blocks: {
        produced: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
        failed: Schemas.createRangeCriteriaSchema(Joi.number().integer().min(0)),
        reliability: Schemas.createRangeCriteriaSchema(Joi.number().min(0)),
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
    collected: {
        fees: {
            burned: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
            retained: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
            total: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        },
        rewards: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        donations: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
        total: Schemas.createRangeCriteriaSchema(Schemas.nonNegativeBigNumber),
    },
    version: Schemas.createRangeCriteriaSchema(Schemas.semver),
};

export const blockProducerCriteriaSchema = Schemas.createCriteriaSchema(blockProducerCriteriaSchemaObject);
export const blockProducerSortingSchema = Schemas.createSortingSchema(blockProducerCriteriaSchemaObject);

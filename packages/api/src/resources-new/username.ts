import { Contracts } from "@solar-network/kernel";
import Joi from "joi";

import * as Schemas from "../schemas";
import { walletCriteriaSchemaObject } from "./wallet";

export type UsernameCriteria = Contracts.Search.StandardCriteriaOf<UsernameResource>;

export type UsernameResource = {
    address: string;
    blockProducer: boolean;
    publicKey: string;
    username: string;
};

export const usernameCriteriaSchemaObject = {
    address: walletCriteriaSchemaObject.address,
    blockProducer: Joi.boolean(),
    username: walletCriteriaSchemaObject.username,
    publicKey: walletCriteriaSchemaObject.publicKey,
};

export const usernameCriteriaSchema = Schemas.createCriteriaSchema(usernameCriteriaSchemaObject);
export const usernameSortingSchema = Schemas.createSortingSchema(usernameCriteriaSchemaObject);

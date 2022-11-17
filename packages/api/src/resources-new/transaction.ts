import Joi from "joi";

import * as Schemas from "../schemas";
import { walletCriteriaSchemaObject } from "./wallet";

export const transactionIdSchema = Joi.string().hex().length(64);

export const transactionCriteriaSchemaObject = {
    id: Joi.alternatives(
        transactionIdSchema,
        Joi.string()
            .regex(/^[0-9a-z%]{1,64}$/)
            .regex(/%/),
    ),
    senderId: walletCriteriaSchemaObject.address,
    recipientId: walletCriteriaSchemaObject.address,
    memo: Joi.string().max(255),
};

export const transactionParamSchema = transactionIdSchema;
export const transactionSortingSchema = Schemas.createSortingSchema(
    Schemas.transactionCriteriaSchemasWithoutUnsortables,
    [],
    false,
);

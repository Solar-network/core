import Hapi from "@hapi/hapi";
import Joi from "joi";

import { BlockProducersController } from "../controllers/block-producers";
import {
    blockProducerCriteriaSchema,
    blockProducerSortingSchema,
    blockProductionFailureSortingSchema,
    blockSortingSchemaWithoutUsernameOrGeneratorPublicKey,
    walletCriteriaSchema,
    walletParamSchema,
    walletSortingSchema,
} from "../resources-new";
import * as Schemas from "../schemas";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(BlockProducersController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/block-producers",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.index(request, h),
        options: {
            validate: {
                query: Joi.object()
                    .concat(blockProducerCriteriaSchema)
                    .concat(blockProducerSortingSchema)
                    .concat(Schemas.pagination),
            },
            plugins: {
                pagination: { enabled: true },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/block-producers/{id}",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.show(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
            },
        },
    });

    server.route({
        method: "GET",
        path: "/block-producers/{id}/voters",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.voters(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
                query: Joi.object().concat(walletCriteriaSchema).concat(walletSortingSchema).concat(Schemas.pagination),
            },
            plugins: {
                pagination: { enabled: true },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/block-producers/{id}/blocks",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.blocks(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
                query: Joi.object({
                    ...server.app.schemas.blockCriteriaSchemasWithoutUsernameOrGeneratorPublicKey,
                    orderBy: server.app.schemas.blocksOrderBy,
                    transform: Joi.bool().default(true),
                })
                    .concat(blockSortingSchemaWithoutUsernameOrGeneratorPublicKey)
                    .concat(Schemas.pagination),
            },
            plugins: {
                pagination: {
                    enabled: true,
                },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/block-producers/{id}/blocks/failures",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.blockProductionFailures(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
                query: Joi.object({
                    ...server.app.schemas.blockCriteriaSchemasWithoutUsernameOrGeneratorPublicKey,
                    orderBy: server.app.schemas.blockProductionFailuresOrderBy,
                })
                    .concat(blockProductionFailureSortingSchema)
                    .concat(Schemas.pagination),
            },
            plugins: {
                pagination: {
                    enabled: true,
                },
            },
        },
    });
};

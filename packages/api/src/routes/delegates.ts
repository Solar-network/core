import Hapi from "@hapi/hapi";
import Joi from "joi";

import { DelegatesController } from "../controllers/delegates";
import {
    blockQueryLevelOptions,
    blockSortingSchemaWithoutUsernameOrGeneratorPublicKey,
    delegateCriteriaSchema,
    delegateSortingSchema,
    missedBlockQueryLevelOptions,
    missedBlockSortingSchema,
    walletCriteriaSchema,
    walletParamSchema,
    walletSortingSchema,
} from "../resources-new";
import * as Schemas from "../schemas";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(DelegatesController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/delegates",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.index(request, h),
        options: {
            validate: {
                query: Joi.object()
                    .concat(delegateCriteriaSchema)
                    .concat(delegateSortingSchema)
                    .concat(Schemas.pagination),
            },
            plugins: {
                pagination: { enabled: true },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/delegates/{id}",
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
        path: "/delegates/{id}/voters",
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
        path: "/delegates/{id}/blocks",
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
                semaphore: {
                    enabled: true,
                    type: "database",
                    queryLevelOptions: blockQueryLevelOptions,
                },
                pagination: {
                    enabled: true,
                },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/delegates/{id}/blocks/missed",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.missedBlocks(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
                query: Joi.object({
                    ...server.app.schemas.missedBlockCriteriaSchemasWithoutUsername,
                    orderBy: server.app.schemas.missedBlocksOrderBy,
                })
                    .concat(missedBlockSortingSchema)
                    .concat(Schemas.pagination),
            },
            plugins: {
                semaphore: {
                    enabled: true,
                    type: "database",
                    queryLevelOptions: missedBlockQueryLevelOptions,
                },
                pagination: {
                    enabled: true,
                },
            },
        },
    });
};

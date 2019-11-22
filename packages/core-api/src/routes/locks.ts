import Hapi from "@hapi/hapi";
import Joi from "@hapi/joi";

import { LocksController } from "../controllers/locks";
import { orderBy } from "../schemas";
import { Enums } from "@arkecosystem/crypto";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(LocksController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/locks",
        handler: controller.index,
        options: {
            validate: {
                query: {
                    ...server.app.schemas.pagination,
                    ...{
                        orderBy,
                        recipientId: Joi.string()
                            .alphanum()
                            .length(34),
                        senderPublicKey: Joi.string()
                            .hex()
                            .length(66),
                        lockId: Joi.string()
                            .hex()
                            .length(64),
                        secretHash: Joi.string()
                            .hex()
                            .length(64),
                        amount: Joi.number()
                            .integer()
                            .min(0),
                        expirationValue: Joi.number()
                            .integer()
                            .min(0),
                        expirationType: Joi.number().only(...Object.values(Enums.HtlcLockExpirationType)),
                        isExpired: Joi.bool(),
                    },
                },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/locks/{id}",
        handler: controller.show,
        options: {
            validate: {
                params: {
                    id: Joi.string()
                        .hex()
                        .length(64),
                },
            },
        },
    });

    server.route({
        method: "POST",
        path: "/locks/search",
        handler: controller.search,
        options: {
            validate: {
                query: {
                    ...server.app.schemas.pagination,
                    ...{
                        orderBy,
                    },
                },
                payload: {
                    recipientId: Joi.string()
                        .alphanum()
                        .length(34),
                    senderPublicKey: Joi.string()
                        .hex()
                        .length(66),
                    lockId: Joi.string()
                        .hex()
                        .length(64),
                    secretHash: Joi.string()
                        .hex()
                        .length(64),
                    amount: Joi.object().keys({
                        from: Joi.number()
                            .integer()
                            .min(0),
                        to: Joi.number()
                            .integer()
                            .min(0),
                    }),
                    timestamp: Joi.object().keys({
                        from: Joi.number()
                            .integer()
                            .min(0),
                        to: Joi.number()
                            .integer()
                            .min(0),
                    }),
                    vendorField: Joi.string()
                        .min(1)
                        .max(255),
                    expirationType: Joi.number().only(...Object.values(Enums.HtlcLockExpirationType)),
                    expirationValue: Joi.object().keys({
                        from: Joi.number()
                            .integer()
                            .min(0),
                        to: Joi.number()
                            .integer()
                            .min(0),
                    }),
                    isExpired: Joi.bool(),
                },
            },
        },
    });

    server.route({
        method: "POST",
        path: "/locks/unlocked",
        handler: controller.unlocked,
        options: {
            validate: {
                query: {
                    ...server.app.schemas.pagination,
                    ...{
                        orderBy,
                    },
                },
                payload: {
                    ids: Joi.array()
                        .unique()
                        .min(1)
                        .max(25)
                        .items(
                            Joi.string()
                                .hex()
                                .length(64),
                        ),
                },
            },
        },
    });
};

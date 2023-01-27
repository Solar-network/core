import Hapi from "@hapi/hapi";
import Joi from "joi";

import { UsernamesController } from "../controllers/usernames";
import { usernameCriteriaSchema, usernameSortingSchema, walletParamSchema } from "../resources-new";
import * as Schemas from "../schemas";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(UsernamesController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/usernames",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.index(request, h),
        options: {
            validate: {
                query: Joi.object()
                    .concat(usernameCriteriaSchema)
                    .concat(usernameSortingSchema)
                    .concat(Schemas.pagination),
            },
            plugins: {
                pagination: { enabled: true },
            },
        },
    });

    server.route({
        method: "GET",
        path: "/usernames/{id}",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.show(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: walletParamSchema,
                }),
            },
        },
    });
};

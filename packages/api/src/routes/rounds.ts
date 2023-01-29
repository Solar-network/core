import Hapi from "@hapi/hapi";
import Joi from "joi";

import { RoundsController } from "../controllers/rounds";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(RoundsController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/rounds/last",
        handler: () => controller.last(),
    });

    server.route({
        method: "GET",
        path: "/rounds/{id}",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.index(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: Joi.number().integer().min(1),
                }),
            },
        },
    });
};

import Hapi from "@hapi/hapi";
import Joi from "joi";

import { RoundsController } from "../controllers/rounds";

export const register = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(RoundsController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/rounds/{id}/delegates",
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => controller.delegates(request, h),
        options: {
            validate: {
                params: Joi.object({
                    id: Joi.number().integer().min(1),
                }),
            },
            plugins: {
                semaphore: {
                    enabled: true,
                    type: "database",
                },
            },
        },
    });
};

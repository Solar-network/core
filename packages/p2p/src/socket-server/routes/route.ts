import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";
import Joi from "joi";

import { Controller } from "../controllers/controller";

export type Codec = {
    request: {
        serialise: any;
        deserialise: any;
    };
    response: {
        serialise: any;
        deserialise: any;
    };
};

export type RouteConfig = {
    id: string;
    handler: any;
    validation?: Joi.Schema;
    codec: Codec;
    maxBytes?: number;
};

@Container.injectable()
export abstract class Route {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    public register(server: Hapi.Server): void {
        const controller = this.getController(server);
        server.bind(controller);

        for (const [path, config] of Object.entries(this.getRoutesConfigByPath())) {
            server.route({
                method: "POST",
                path,
                config: {
                    id: config.id,
                    handler: config.handler,
                    payload: {
                        maxBytes: config.maxBytes,
                    },
                    isInternal: true,
                },
            } as Hapi.ServerRoute);
        }
    }

    public abstract getRoutesConfigByPath(): { [path: string]: RouteConfig };

    protected abstract getController(server: Hapi.Server): Controller;
}

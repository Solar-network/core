import Boom from "@hapi/boom";
import { Server } from "@hapi/hapi";
import { Utils } from "@solar-network/kernel";
import { URL } from "url";

export const origin = {
    name: "origin",
    version: "0.1.0",
    register(server: Server, options: { origin: string[] }): void {
        server.ext({
            type: "onRequest",
            async method(request, h) {
                if (!options.origin) {
                    return h.continue;
                }

                let hostname: string;
                try {
                    ({ hostname } = new URL(request.headers.origin));
                } catch {
                    hostname = "*";
                }

                if (Utils.isWhitelisted(options.origin, hostname)) {
                    return h.continue;
                }

                return Boom.forbidden();
            },
        });
    },
};

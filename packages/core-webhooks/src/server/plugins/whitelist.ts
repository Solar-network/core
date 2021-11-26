import Boom from "@hapi/boom";
import { Server } from "@hapi/hapi";
import { Utils } from "@solar-network/core-kernel";

export const whitelist = {
    name: "whitelist",
    version: "0.1.0",
    register(server: Server, options): void {
        server.ext({
            type: "onRequest",
            async method(request, h) {
                if (!options.whitelist) {
                    return h.continue;
                }

                if (Utils.isWhitelisted(options.whitelist, request.info.remoteAddress)) {
                    return h.continue;
                }

                return Boom.forbidden();
            },
        });
    },
};

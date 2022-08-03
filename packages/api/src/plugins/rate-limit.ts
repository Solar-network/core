import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { RLWrapperBlackAndWhite } from "rate-limiter-flexible";

import { getIp } from "../utils";

export const rateLimit: Hapi.Plugin<any> = {
    name: "rate-limit",
    version: "1.0.0",
    once: true,
    async register(
        server: Hapi.Server,
        options: {
            enabled: boolean;
            rateLimiter: RLWrapperBlackAndWhite;
            trustProxy: boolean;
        },
    ): Promise<void> {
        if (!options.enabled) {
            return;
        }

        server.ext({
            type: "onPostAuth",
            async method(request, h) {
                try {
                    await options.rateLimiter.consume(getIp(request, options.trustProxy), 1);
                } catch (rateLimitRes) {
                    if (rateLimitRes instanceof Error) {
                        return Boom.internal(rateLimitRes.message);
                    }

                    return Boom.tooManyRequests();
                }

                return h.continue;
            },
        });
    },
};

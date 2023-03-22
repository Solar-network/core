import inert from "@hapi/inert";
import { plugin as hapiNesPlugin } from "@solar-network/nes";
import mm from "nanomatch";
import { RateLimiterMemory, RLWrapperBlackAndWhite } from "rate-limiter-flexible";

import { cache } from "./cache";
import { closeConnection } from "./close-connection";
import { dotSeparatedQuery } from "./dot-separated-query";
import { log } from "./log";
import { origin } from "./origin";
import { pagination } from "./pagination";
import { rateLimit } from "./rate-limit";
import { responseHeaders } from "./response-headers";
import { whitelist } from "./whitelist";

const isListed = (ip: string, patterns: string[]): boolean => {
    if (!Array.isArray(patterns)) {
        return true;
    }

    for (const pattern of patterns) {
        if (mm.isMatch(ip, pattern)) {
            return true;
        }
    }

    return false;
};

export const preparePlugins = (config) => {
    const rateLimiter = new RLWrapperBlackAndWhite({
        limiter: new RateLimiterMemory({
            points: config.plugins.rateLimit.points,
            duration: config.plugins.rateLimit.duration,
        }),
        whiteList: config.plugins.rateLimit.whitelist || ["*"],
        blackList: config.plugins.rateLimit.blacklist || [],
        isWhite: (ip: string) => {
            return isListed(ip, config.plugins.rateLimit.whitelist);
        },
        isBlack: (ip: string) => {
            return isListed(ip, config.plugins.rateLimit.blacklist);
        },
        runActionAnyway: false,
    });

    return [
        {
            plugin: whitelist,
            options: {
                whitelist: config.plugins.whitelist,
                trustProxy: config.plugins.trustProxy,
            },
        },
        {
            plugin: origin,
            options: {
                origin: config.plugins.origin,
            },
        },
        {
            plugin: log,
            options: {
                ...config.plugins.log,
                trustProxy: config.plugins.trustProxy,
            },
        },
        { plugin: closeConnection },
        {
            plugin: hapiNesPlugin,
            options: {
                banSeconds: config.ws.banSeconds,
                basePath: config.options.basePath,
                disableGet: config.ws.disableGet,
                disablePost: config.ws.disablePost,
                enabled: config.ws.enabled,
                maxPayload: 1048576,
                path: config.ws.path,
                rateLimiter: rateLimiter,
                sendErrors: true,
                socketRateLimit: config.ws.socketRateLimit,
                trustProxy: config.plugins.trustProxy,
                whitelist: config.plugins.whitelist,
                wsapi: true,
            },
        },
        { plugin: dotSeparatedQuery },
        {
            plugin: cache,
            options: config.plugins.cache,
        },
        { plugin: inert },
        {
            plugin: rateLimit,
            options: {
                enabled: config.plugins.rateLimit.enabled,
                rateLimiter: rateLimiter,
                trustProxy: config.plugins.trustProxy,
            },
        },
        { plugin: pagination },
        { plugin: responseHeaders },
    ];
};

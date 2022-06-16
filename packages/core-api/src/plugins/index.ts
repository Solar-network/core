import inert from "@hapi/inert";

import { cache } from "./cache";
import { closeConnection } from "./close-connection";
import { commaArrayQuery } from "./comma-array-query";
import { dotSeparatedQuery } from "./dot-separated-query";
import { log } from "./log";
import { pagination } from "./pagination";
import { rateLimit } from "./rate-limit";
import { responseHeaders } from "./response-headers";
import { whitelist } from "./whitelist";

export const preparePlugins = (config) => [
    {
        plugin: whitelist,
        options: {
            whitelist: config.whitelist,
            trustProxy: config.trustProxy,
        },
    },
    {
        plugin: log,
        options: {
            ...config.log,
            trustProxy: config.trustProxy,
        },
    },
    { plugin: closeConnection },
    { plugin: commaArrayQuery },
    { plugin: dotSeparatedQuery },
    {
        plugin: cache,
        options: config.cache,
    },
    { plugin: inert },
    {
        plugin: rateLimit,
        options: {
            ...config.rateLimit,
            trustProxy: config.trustProxy,
        },
    },
    {
        plugin: pagination,
        options: {
            query: {
                limit: {
                    default: config.pagination.limit,
                },
            },
        },
    },
    { plugin: responseHeaders },
];

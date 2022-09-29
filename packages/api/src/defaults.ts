import { Enums } from "@solar-network/kernel";

export const defaults = {
    server: {
        http: {
            enabled: process.env.SOLAR_CORE_API_DISABLED?.toLowerCase() !== "true",
            host: process.env.SOLAR_CORE_API_HOST || "0.0.0.0",
            port: process.env.SOLAR_CORE_API_PORT || 4003,
        },
        // @see https://hapijs.com/api#-serveroptionstls
        https: {
            enabled: process.env.SOLAR_CORE_API_SSL?.toLowerCase() === "true",
            host: process.env.SOLAR_CORE_API_SSL_HOST || "0.0.0.0",
            port: process.env.SOLAR_CORE_API_SSL_PORT || 8443,
            tls: {
                key: process.env.SOLAR_CORE_API_SSL_KEY,
                cert: process.env.SOLAR_CORE_API_SSL_CERT,
            },
        },
    },
    plugins: {
        log: {
            enabled: process.env.SOLAR_CORE_API_LOG?.toLowerCase() === "true",
        },
        cache: {
            enabled: process.env.SOLAR_CORE_API_CACHE?.toLowerCase() === "true",
            stdTTL: 8,
            checkperiod: 120,
        },
        rateLimit: {
            enabled: process.env.SOLAR_CORE_API_RATE_LIMIT_DISABLED?.toLowerCase() !== "true",
            points: process.env.SOLAR_CORE_API_RATE_LIMIT_USER_LIMIT || 100,
            duration: process.env.SOLAR_CORE_API_RATE_LIMIT_USER_EXPIRES || 60,
            whitelist: process.env.SOLAR_CORE_API_RATE_LIMIT_WHITELIST
                ? process.env.SOLAR_CORE_API_RATE_LIMIT_WHITELIST.split(",")
                : [],
            blacklist: process.env.SOLAR_CORE_API_RATE_LIMIT_BLACKLIST
                ? process.env.SOLAR_CORE_API_RATE_LIMIT_BLACKLIST.split(",")
                : [],
        },
        socketTimeout: 5000,
        whitelist: ["*"],
        trustProxy: process.env.SOLAR_CORE_API_TRUST_PROXY?.toLowerCase() === "true",
    },
    options: {
        basePath: "/api",
        estimateTotalCount: process.env.SOLAR_CORE_API_ESTIMATED_TOTAL_COUNT?.toLowerCase() === "true",
    },
    ws: {
        banSeconds: 10,
        disableGet: process.env.SOLAR_CORE_API_WS_GET_DISABLED?.toLowerCase() === "true",
        disablePost: process.env.SOLAR_CORE_API_WS_POST_DISABLED?.toLowerCase() === "true",
        enabled: process.env.SOLAR_CORE_API_WS_DISABLED?.toLowerCase() !== "true",
        events: [
            Enums.BlockEvent.Applied,
            Enums.BlockEvent.Reverted,
            Enums.DelegateEvent.ProductivityChanged,
            Enums.ForgerEvent.Missing,
            Enums.RoundEvent.Created,
            Enums.RoundEvent.Missed,
            Enums.TransactionEvent.Applied,
            Enums.TransactionEvent.Reverted,
            Enums.VoteEvent.Vote,
        ],
        path: "/ws",
    },
};

import { Enums } from "@solar-network/kernel";

export const defaults = {
    server: {
        http: {
            enabled: !process.env.CORE_API_DISABLED,
            host: process.env.CORE_API_HOST || "0.0.0.0",
            port: process.env.CORE_API_PORT || 4003,
        },
        // @see https://hapijs.com/api#-serveroptionstls
        https: {
            enabled: !!process.env.CORE_API_SSL,
            host: process.env.CORE_API_SSL_HOST || "0.0.0.0",
            port: process.env.CORE_API_SSL_PORT || 8443,
            tls: {
                key: process.env.CORE_API_SSL_KEY,
                cert: process.env.CORE_API_SSL_CERT,
            },
        },
    },
    plugins: {
        log: {
            enabled: !!process.env.CORE_API_LOG,
        },
        cache: {
            enabled: !!process.env.CORE_API_CACHE,
            stdTTL: 8,
            checkperiod: 120,
        },
        rateLimit: {
            enabled: !process.env.CORE_API_RATE_LIMIT_DISABLED,
            points: process.env.CORE_API_RATE_LIMIT_USER_LIMIT || 100,
            duration: process.env.CORE_API_RATE_LIMIT_USER_EXPIRES || 60, // Sec
            whitelist: process.env.CORE_API_RATE_LIMIT_WHITELIST
                ? process.env.CORE_API_RATE_LIMIT_WHITELIST.split(",")
                : [],
            blacklist: process.env.CORE_API_RATE_LIMIT_BLACKLIST
                ? process.env.CORE_API_RATE_LIMIT_BLACKLIST.split(",")
                : [],
        },
        socketTimeout: 5000,
        whitelist: ["*"],
        trustProxy: !!process.env.CORE_API_TRUST_PROXY,
    },
    options: {
        basePath: "/api",
        estimateTotalCount: !!process.env.CORE_API_ESTIMATED_TOTAL_COUNT,
    },
    ws: {
        banSeconds: 10,
        disableGet: !!process.env.CORE_API_WS_GET_DISABLED,
        disablePost: !!process.env.CORE_API_WS_POST_DISABLED,
        enabled: !process.env.CORE_API_WS_DISABLED,
        events: [
            Enums.BlockEvent.Applied,
            Enums.BlockEvent.Reverted,
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
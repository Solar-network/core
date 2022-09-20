export const defaults = {
    logLevel: process.env.CORE_LOG_LEVEL || "debug",
    fileRotator: {
        interval: "1d",
    },
};

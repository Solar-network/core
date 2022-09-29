export const defaults = {
    maxSavedStates: 3,
    maxSavedStateAge: 25000,
    savedStatesPath: `${process.env.SOLAR_CORE_PATH_DATA}/saved-states`,
    storage: {
        maxLastBlocks: 100,
        maxLastTransactionIds: 10000,
    },
    walletSync: {
        enabled: process.env.SOLAR_CORE_WALLET_SYNC_ENABLED?.toLowerCase() === "true",
    },
};

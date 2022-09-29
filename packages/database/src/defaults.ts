export const defaults = {
    connection: {
        database: `${process.env.SOLAR_CORE_TOKEN}_${process.env.SOLAR_CORE_NETWORK_NAME}`,
        entityPrefix: "public.",
        extra: {
            host: `${process.env.SOLAR_CORE_PATH_DATA}/database`,
        },
        logging: false,
        synchronise: false,
        type: "postgres",
        username: process.env.USER,
    },
};

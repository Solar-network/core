export const defaults = {
    connection: {
        database: `${process.env.CORE_TOKEN}_${process.env.CORE_NETWORK_NAME}`,
        entityPrefix: "public.",
        extra: {
            host: `${process.env.CORE_PATH_DATA}/database`,
        },
        logging: false,
        synchronize: false,
        type: "postgres",
        username: process.env.USER,
    },
};

export const emitEvent = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getUnconfirmedTransactions = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getCurrentRound = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getNetworkState = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getSlotNumber = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const syncBlockchain = {
    request: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialise: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialise: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

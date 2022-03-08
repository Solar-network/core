export const emitEvent = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getUnconfirmedTransactions = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getCurrentRound = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getNetworkState = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const getSlotNumber = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

export const syncBlockchain = {
    request: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
    response: {
        serialize: (obj: object): Buffer => Buffer.from(JSON.stringify(obj)),
        deserialize: (payload: Buffer): object => JSON.parse(payload.toString()),
    },
};

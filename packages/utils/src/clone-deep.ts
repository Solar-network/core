import deepClone from "fast-copy";

export const cloneDeep = <T>(object: T): T => deepClone(object);

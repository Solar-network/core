import { isArray } from "./is-array";
import { isFunction } from "./is-function";
import { isNull } from "./is-null";
import { isString } from "./is-string";
import { isUndefined } from "./is-undefined";

export const castArray = <T>(value: any): T[] => {
    if (isNull(value) || isUndefined(value)) {
        return [];
    }

    if (isArray(value)) {
        return value as T[];
    }

    if (isString(value)) {
        return [(value as unknown) as T];
    }

    if (isFunction(value[Symbol.iterator])) {
        return [...value];
    }

    return [value];
};

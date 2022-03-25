import { getPathSegments } from "./get-path-segments";
import { isObject } from "./is-object";
import { isString } from "./is-string";

export const has = <T>(object: T, path: string | string[]): boolean => {
    if (!isObject(object) || !isString(path)) {
        return false;
    }

    const pathSegments: string[] = getPathSegments(path);

    for (let i = 0; i < pathSegments.length; i++) {
        if (!isObject(object)) {
            return false;
        }

        if (!(pathSegments[i] in object)) {
            return false;
        }

        object = object[pathSegments[i]];
    }

    return true;
};

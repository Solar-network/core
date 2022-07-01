import { getPathSegments } from "./get-path-segments";
import { isObject } from "./is-object";
import { isString } from "./is-string";

export const set = <T>(object: T, path: string | string[], value: unknown): boolean => {
    if (!isObject(object) || !isString(path)) {
        return false;
    }

    const pathSegments: string[] = getPathSegments(path);

    for (let i = 0; i < pathSegments.length; i++) {
        const pathSegment: string = pathSegments[i];

        if (!isObject(object[pathSegment])) {
            object[pathSegment] = {};
        }

        if (i === pathSegments.length - 1) {
            object[pathSegment] = value;
        }

        object = object[pathSegment];
    }

    return true;
};

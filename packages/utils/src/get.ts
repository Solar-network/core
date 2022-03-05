import { getPathSegments } from "./get-path-segments";
import { isEnumerable } from "./is-enumerable";
import { isObject } from "./is-object";
import { isString } from "./is-string";

export const get = <T, V>(object: T, path: string | string[], defaultValue?: V): V | undefined => {
    if (!isObject(object) || !isString(path)) {
        return defaultValue;
    }

    const pathSegments: string[] = getPathSegments(path);

    for (let i = 0; i < pathSegments.length; i++) {
        if (!isEnumerable(object, pathSegments[i])) {
            return defaultValue;
        }

        object = object[pathSegments[i]];

        if (object === undefined || object === null) {
            /* istanbul ignore else */
            if (i !== pathSegments.length - 1) {
                return defaultValue;
            }

            /* istanbul ignore next */
            break;
        }
    }

    return (object as unknown) as V;
};

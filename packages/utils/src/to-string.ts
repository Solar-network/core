import { isNil } from "./is-nil";
import { isString } from "./is-string";

export const toString = <T>(value: T): string => {
    if (isNil(value)) {
        return "";
    }

    return isString(value) ? value : String(value);
};

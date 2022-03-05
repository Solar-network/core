import { FunctionReturning } from "./internal";

export const filterObject = <T>(iterable: T, iteratee: FunctionReturning): T => {
    const keys = Object.keys(iterable);
    const length: number = keys.length;
    const result = {};

    for (let i = 0; i < length; i++) {
        const key = keys[i];

        if (iteratee(iterable[key], key, iterable)) {
            result[key] = iterable[key];
        }
    }

    return result as T;
};

import { FunctionReturning } from "./internal";

export const reduceArray = <T, V>(iterable: T[], iteratee: FunctionReturning, initialValue: V): V | undefined => {
    let result: V = initialValue;

    for (let i = 0; i < iterable.length; i++) {
        result = iteratee(result, iterable[i], i, iterable);
    }

    return result;
};

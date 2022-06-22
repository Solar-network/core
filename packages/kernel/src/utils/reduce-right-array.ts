import { FunctionReturning } from "./internal";

export const reduceRightArray = <T, V>(iterable: T[], iteratee: FunctionReturning, initialValue: V): V => {
    let result: V = initialValue;

    for (let i = iterable.length - 1; i >= 0; i--) {
        result = iteratee(result, iterable[i], i, iterable);
    }

    return result;
};

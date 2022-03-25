import { FunctionReturning } from "./internal";

export const mapArray = <T, R>(iterable: T[], iteratee: FunctionReturning): R[] => {
    const result: R[] = new Array(iterable.length);

    for (let i = 0; i < iterable.length; i++) {
        result[i] = iteratee(iterable[i], i, iterable);
    }

    return result;
};

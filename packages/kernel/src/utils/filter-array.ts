import { FunctionReturning } from "./internal";

export const filterArray = <T>(iterable: T[], iteratee: FunctionReturning): T[] => {
    const result: T[] = [];

    for (let i = 0; i < iterable.length; i++) {
        if (iteratee(iterable[i], i, iterable)) {
            result.push(iterable[i]);
        }
    }

    return result;
};

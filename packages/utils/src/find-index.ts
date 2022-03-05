import { FunctionReturning } from "./internal";

export const findIndex = <T>(iterable: T[], iteratee: FunctionReturning): number => {
    for (let i = 0; i < iterable.length; i++) {
        if (iteratee(iterable[i], i, iterable)) {
            return i;
        }
    }

    return -1;
};

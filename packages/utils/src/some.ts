import { FunctionReturning } from "./internal";

export const some = <T>(iterable: T[], iteratee: FunctionReturning): boolean => {
    for (let i = 0; i < iterable.length; i++) {
        if (iteratee(iterable[i], i, iterable)) {
            return true;
        }
    }

    return false;
};

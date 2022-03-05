import { FunctionReturning } from "./internal";

export const find = <T>(iterable: T[], iteratee: FunctionReturning): T | undefined => {
    for (let i = 0; i < iterable.length; i++) {
        const item: T = iterable[i];

        if (iteratee(item, i, iterable)) {
            return item;
        }
    }

    return undefined;
};

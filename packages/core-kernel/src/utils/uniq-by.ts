import { FunctionReturning } from "./internal";

export const uniqBy = <T>(iterable: T[], iteratee: FunctionReturning): T[] => {
    const result: T[] = [];

    const set: Set<T> = new Set<T>();
    for (let i = 0; i < iterable.length; i++) {
        const value: T = iteratee(iterable[i]);

        if (set.has(value)) {
            continue;
        }

        set.add(value);
        result.push(iterable[i]);
    }

    return result;
};

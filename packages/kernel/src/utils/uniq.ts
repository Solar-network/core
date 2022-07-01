import { indexOf } from "./index-of";

export const uniq = <T>(iterable: T[]): T[] => {
    const result: T[] = [];

    for (let i = 0; i < iterable.length; i++) {
        const value: T = iterable[i];

        if (indexOf(result, value) > -1) {
            continue;
        }

        result.push(value);
    }

    return result;
};

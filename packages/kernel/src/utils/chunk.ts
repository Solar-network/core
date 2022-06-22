import { slice } from "./slice";

export const chunk = <T>(iterable: T[], chunkSize: number): T[][] => {
    const iterableLength: number = iterable.length;

    if (!iterableLength || chunkSize <= 0) {
        return [];
    }

    let index: number = 0;
    let resIndex: number = 0;
    const result: T[][] = Array(Math.ceil(iterableLength / chunkSize));

    while (index < iterableLength) {
        result[resIndex++] = slice<T>(iterable, index, (index += chunkSize));
    }

    return result;
};

// Taken from https://raw.githubusercontent.com/lodash/lodash/4.17.15-post/lodash.js

/* istanbul ignore next */
export const slice = <T>(array: T[], start: number, end: number): T[] => {
    let index = -1;
    let length = array.length;

    if (start < 0) {
        start = -start > length ? 0 : length + start;
    }

    end = end > length ? length : end;

    if (end < 0) {
        end += length;
    }

    length = start > end ? 0 : (end - start) >>> 0;
    start >>>= 0;

    const result: T[] = Array(length);

    while (++index < length) {
        result[index] = array[index + start];
    }

    return result;
};

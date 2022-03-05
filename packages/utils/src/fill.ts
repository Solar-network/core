export const fill = <T, V>(subject: T[], value: V, start?: number, end?: number): (T | V)[] => {
    if (start === undefined) {
        start = 0;
    }

    if (end === undefined) {
        end = subject.length;
    }

    const results: (T | V)[] = [...subject];

    for (let i = start; i < end; i++) {
        results[i] = value;
    }

    return results;
};

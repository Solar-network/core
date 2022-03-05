export const lastIndexOf = <T>(subject: T[], target: T, fromIndex?: number): number => {
    const length: number = subject.length;
    let i = length - 1;

    if (fromIndex) {
        i = fromIndex;

        if (i < 0) {
            i += length;
        }
    }

    for (; i >= 0; i--) {
        if (subject[i] === target) {
            return i;
        }
    }

    return -1;
};

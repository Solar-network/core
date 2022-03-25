export const pick = <T>(iterable: T, keys: string[]): T => {
    const newValues = {};

    for (const key of keys) {
        newValues[key] = iterable[key];
    }

    return newValues as T;
};

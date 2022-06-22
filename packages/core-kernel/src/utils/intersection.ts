export const intersection = <T>(target: T[], source: T[]): T[] => {
    const common: T[] = [];

    const hash: Set<T> = new Set<T>(target);
    const found: Set<T> = new Set<T>();

    for (const value of source) {
        if (hash.has(value) && !found.has(value)) {
            common.push(value);
            found.add(value);
        }
    }

    return [...common];
};

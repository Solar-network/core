const flat = <T>(iterable: T[], stash: T[]): T[] => {
    for (const element of iterable) {
        Array.isArray(element) ? flat(element, stash) : stash.push(element);
    }

    return stash;
};

export const flatten = <T>(iterable: T[]): T[] => flat(iterable, []);

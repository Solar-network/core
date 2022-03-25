export const keysIn = <T>(value: T): string[] => {
    const prototype: T = Object.getPrototypeOf(value);

    return [...new Set(Object.getOwnPropertyNames(value).concat(prototype ? keysIn(prototype) : []))];
};

export const stringify = <T>(value: T): string | undefined => {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
};

export const isEmpty = <T>(value: T): boolean => {
    if (!value) {
        return true;
    }

    if (value instanceof Map || value instanceof Set) {
        return value.size <= 0;
    }

    if (typeof value === "object" && Object.keys(value).length <= 0) {
        return true;
    }

    return (value as any).length <= 0;
};

export const hashString = (value: string): number => {
    let hash: number = 5381;
    let remaining: number = value.length;

    while (remaining) {
        hash = (hash * 33) ^ value.charCodeAt(--remaining);
    }

    return hash >>> 0;
};

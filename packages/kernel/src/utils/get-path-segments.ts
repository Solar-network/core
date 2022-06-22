const disallowedKeys: string[] = ["__proto__", "prototype", "constructor"];

export const getPathSegments = (value: string | string[]): string[] => {
    const segments: string[] = Array.isArray(value) ? value : value.split(".");

    return segments.some((segment: string) => disallowedKeys.includes(segment)) ? [] : segments;
};

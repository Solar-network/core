const disallowedKeys: string[] = ["__proto__", "prototype", "constructor"];

export const getPathSegments = (value: string | string[]): string[] => {
    const segments: string[] = Array.isArray(value)
        ? value
        : (value.match(/(".*?"|[^".\s]+)+(?=\s*\.|\s*$)/g) ?? []).map((segment: string) => segment.replaceAll('"', ""));

    return segments.some((segment: string) => disallowedKeys.includes(segment)) ? [] : segments;
};

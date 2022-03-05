// @ts-ignore
const { compare } = new Intl.Collator(0, { numeric: 1 });

export const comparator = (value: string, other: string): number => {
    const a: string[] = value.split(".");
    const b: string[] = other.split(".");

    const hasSameMajor: number = compare(a[0], b[0]);

    if (hasSameMajor) {
        return hasSameMajor;
    }

    const hasSameMinor: number = compare(a[1], b[1]);

    if (hasSameMinor) {
        return hasSameMinor;
    }

    return compare(a.slice(2).join("."), b.slice(2).join("."));
};

const isEqual = (value: string, other: string): boolean => comparator(value, other) === 0;

const isGreaterThan = (value: string, other: string): boolean => comparator(value, other) === 1;

const isGreaterThanOrEqual = (value: string, other: string): boolean =>
    isGreaterThan(value, other) || isEqual(value, other);

const isLessThan = (value: string, other: string): boolean => comparator(value, other) === -1;

const isLessThanOrEqual = (value: string, other: string): boolean => isLessThan(value, other) || isEqual(value, other);

export const semver = {
    isEqual,
    isGreaterThan,
    isGreaterThanOrEqual,
    isLessThan,
    isLessThanOrEqual,
};

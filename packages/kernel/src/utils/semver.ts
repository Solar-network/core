import * as semver from "semver";

export class Semver {
    private readonly value: string;

    public constructor(value: string | Semver) {
        this.value = value.toString();
    }

    public comparedTo(other: Semver): number {
        const otherValue = semver.clean(other.toString()) as string;
        if (semver.gt(this.value, otherValue)) {
            return 1;
        }

        if (semver.lt(this.value, otherValue)) {
            return -1;
        }

        return 0;
    }

    public isEqualTo(other: Semver): boolean {
        const otherValue = semver.clean(other.toString()) as string;
        return semver.eq(this.value, otherValue);
    }

    public isLessThan(other: Semver): boolean {
        const otherValue = semver.clean(other.toString()) as string;
        return semver.lt(this.value, otherValue);
    }

    public isLessThanEqual(other: Semver): boolean {
        const otherValue = semver.clean(other.toString()) as string;
        return semver.lte(this.value, otherValue);
    }

    public isGreaterThan(other: Semver): boolean {
        const otherValue = semver.clean(other.toString()) as string;
        return semver.gt(this.value, otherValue);
    }

    public isGreaterThanEqual(other: Semver): boolean {
        const otherValue = semver.clean(other.toString()) as string;
        return semver.gte(this.value, otherValue);
    }

    public isValid(): boolean {
        return semver.valid(this.value) !== null;
    }

    public toString() {
        return this.value;
    }

    public toJSON() {
        return this.value;
    }
}

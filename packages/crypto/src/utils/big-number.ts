type BigNumberType = BigInt | number | string | BigNumber;

export class BigNumber {
    public static readonly ZERO: BigNumber = new BigNumber(0);
    public static readonly ONE: BigNumber = new BigNumber(1);
    public static readonly SATOSHI: BigNumber = new BigNumber(1e8);

    private readonly value: bigint;

    public constructor(value: BigNumberType) {
        this.value = this.toBigNumber(value);
    }

    public static make(value: BigNumberType): BigNumber {
        return new BigNumber(value);
    }

    public plus(other: BigNumberType): BigNumber {
        return new BigNumber(this.value + this.toBigNumber(other));
    }

    public minus(other: BigNumberType): BigNumber {
        return new BigNumber(this.value - this.toBigNumber(other));
    }

    public times(other: BigNumberType): BigNumber {
        return new BigNumber(this.value * this.toBigNumber(other));
    }

    public dividedBy(other: BigNumberType): BigNumber {
        return new BigNumber(this.value / this.toBigNumber(other));
    }

    public div(other: BigNumberType): BigNumber {
        return this.dividedBy(other);
    }

    public isZero(): boolean {
        return this.value === BigInt(0);
    }

    public comparedTo(other: BigNumberType): number {
        const b = this.toBigNumber(other);

        if (this.value > b) {
            return 1;
        }

        if (this.value < b) {
            return -1;
        }

        return 0;
    }

    public isLessThan(other: BigNumberType): boolean {
        return this.value < this.toBigNumber(other);
    }

    public isLessThanEqual(other: BigNumberType): boolean {
        return this.value <= this.toBigNumber(other);
    }

    public isGreaterThan(other: BigNumberType): boolean {
        return this.value > this.toBigNumber(other);
    }

    public isGreaterThanEqual(other: BigNumberType): boolean {
        return this.value >= this.toBigNumber(other);
    }

    public isEqualTo(other: BigNumberType): boolean {
        return this.value === this.toBigNumber(other);
    }

    public isNegative(): boolean {
        return this.value < 0;
    }

    public toFixed(): string {
        return this.value.toString();
    }

    public toString(base: number = 10): string {
        return this.value.toString(base);
    }

    public toJSON(): string {
        return this.toFixed();
    }

    public toBigInt(): bigint {
        return this.value;
    }

    private toBigNumber(value: BigNumberType): bigint {
        if (value instanceof BigNumber) {
            value = value.value;
        }

        return BigInt(value as bigint);
    }
}

import { isNumber } from "./is-number";

export const isPositive = (value: number | BigInt): boolean => isNumber(value) && value > 0;

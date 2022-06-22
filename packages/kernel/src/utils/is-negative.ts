import { isNumber } from "./is-number";

export const isNegative = (value: number): boolean => isNumber(value) && value < 0;

import { isArrayOfType } from "./is-array-of-type";

export const isNumberArray = (value: unknown): value is number[] => isArrayOfType<number>(value, "number");

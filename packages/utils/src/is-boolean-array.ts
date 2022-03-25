import { isArrayOfType } from "./is-array-of-type";

export const isBooleanArray = (value: unknown): value is boolean[] => isArrayOfType<boolean>(value, "boolean");

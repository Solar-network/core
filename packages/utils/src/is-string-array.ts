import { isArrayOfType } from "./is-array-of-type";

export const isStringArray = (value: unknown): value is string[] => isArrayOfType<string>(value, "string");

import { isArray } from "./is-array";

export const isArrayOfType = <T>(value: unknown, type: string): value is T[] =>
    isArray(value) && value.every((element) => typeof element === type);

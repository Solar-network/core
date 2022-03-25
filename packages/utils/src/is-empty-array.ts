import { isArray } from "./is-array";

export const isEmptyArray = <T>(value: T[]): boolean => isArray(value) && value.length <= 0;

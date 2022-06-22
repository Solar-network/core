import { isEqual } from "./is-equal";

export const isNotEqual = <T>(a: T, b: T): boolean => !isEqual(a, b);

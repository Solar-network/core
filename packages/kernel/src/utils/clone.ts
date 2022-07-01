import { cloneArray } from "./clone-array";
import { cloneObject } from "./clone-object";
import { isArray } from "./is-array";

export const clone = <T>(iterable: T | T[]): T | T[] =>
    isArray(iterable) ? cloneArray(iterable) : cloneObject(iterable);

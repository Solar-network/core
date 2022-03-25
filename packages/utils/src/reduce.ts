import { FunctionReturning } from "./internal";
import { isArray } from "./is-array";
import { reduceArray } from "./reduce-array";
import { reduceObject } from "./reduce-object";

export const reduce = <T, V>(iterable: T | T[], iteratee: FunctionReturning, initialValue: V): V | V[] | undefined =>
    isArray(iterable) ? reduceArray(iterable, iteratee, initialValue) : reduceObject(iterable, iteratee, initialValue);

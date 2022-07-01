import { FunctionReturning } from "./internal";
import { isArray } from "./is-array";
import { reduceRightArray } from "./reduce-right-array";
import { reduceRightObject } from "./reduce-right-object";

export const reduceRight = <T, V>(
    iterable: T | T[],
    iteratee: FunctionReturning,
    initialValue: V,
): V | V[] | undefined =>
    isArray(iterable)
        ? reduceRightArray(iterable, iteratee, initialValue)
        : reduceRightObject(iterable, iteratee, initialValue);

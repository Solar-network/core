import { filterArray } from "./filter-array";
import { filterObject } from "./filter-object";
import { FunctionReturning } from "./internal";
import { isArray } from "./is-array";

export const filter = <T>(iterable: T | T[], iteratee: FunctionReturning): T | T[] =>
    isArray(iterable) ? filterArray(iterable, iteratee) : filterObject(iterable, iteratee);

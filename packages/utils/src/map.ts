import { FunctionReturning } from "./internal";
import { isArray } from "./is-array";
import { mapArray } from "./map-array";
import { mapObject } from "./map-object";

export const map = <T, R>(iterable: T | T[], iteratee: FunctionReturning): R | R[] =>
    isArray(iterable) ? mapArray(iterable, iteratee) : mapObject(iterable, iteratee);

import { filter } from "./filter";
import { FunctionReturning } from "./internal";

export const pickBy = <T>(iterable: T, iteratee: FunctionReturning): T =>
    filter(iterable as any, (value) => iteratee(value));

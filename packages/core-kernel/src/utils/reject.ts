import { filter } from "./filter";
import { FunctionReturning } from "./internal";

export const reject = <T>(iterable: T[], iteratee: FunctionReturning): T[] =>
    filter(iterable, (item) => !iteratee(item)) as T[];

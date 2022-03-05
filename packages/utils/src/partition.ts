import { FunctionReturning } from "./internal";

export const partition = <T>(iterable: T[], iteratee: FunctionReturning): [T[], T[]] =>
    iterable.reduce(
        (result: [T[], T[]], value: T) => {
            result[iteratee(value) ? 0 : 1].push(value);

            return result;
        },
        [[], []],
    );

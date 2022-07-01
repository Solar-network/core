import { FunctionReturning } from "./internal";

export const keyBy = <T>(iterable: T[], iteratee: FunctionReturning): object =>
    iterable.reduce((result, value) => {
        result[iteratee(value)] = value;

        return result;
    }, {});

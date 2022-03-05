import sort from "fast-sort";

import { FunctionReturning, Iteratee } from "./internal";
import { isFunction } from "./is-function";
import { isString } from "./is-string";
import { map } from "./map";

export const orderBy = <T>(values: T[], iteratees: Iteratee | Iteratee[], orders: string | string[]): T[] => {
    if (isString(iteratees)) {
        iteratees = [iteratees] as string[];
    } else if (isFunction(iteratees)) {
        iteratees = [iteratees] as FunctionReturning[];
    }

    if (isString(orders)) {
        orders = [orders];
    }

    return sort(values).by(
        map(iteratees as any, (_: string, index: number) => ({ [orders[index]]: iteratees[index] })),
    );
};

import { Iteratee } from "../internal";
import { orderBy as baseOrderBy } from "../order-by";

export const orderBy = <T>(values: T[], iteratees: Iteratee | Iteratee[], orders: string | string[]): T[] =>
    baseOrderBy([...values], iteratees, orders);

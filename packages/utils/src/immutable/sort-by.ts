import { ISortBy, ISortByFunction } from "fast-sort";

import { sortBy as baseSortBy } from "../sort-by";

export const sortBy = <T>(
    values: T[],
    iteratees?: ISortByFunction<T> | keyof T | (ISortByFunction<T> | keyof T)[] | ISortBy<T>[] | undefined,
): T[] => baseSortBy([...values], iteratees);

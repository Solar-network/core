import { ISortBy, ISortByFunction } from "fast-sort";

import { sortByDesc as baseSortByDesc } from "../sort-by-desc";

export const sortByDesc = <T>(
    values: T[],
    iteratees?: ISortByFunction<T> | keyof T | (ISortByFunction<T> | keyof T)[] | ISortBy<T>[] | undefined,
): T[] => baseSortByDesc([...values], iteratees);

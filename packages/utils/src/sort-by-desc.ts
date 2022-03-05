import sort, { ISortBy, ISortByFunction } from "fast-sort";

export const sortByDesc = <T>(
    values: T[],
    iteratees?: ISortByFunction<T> | keyof T | (ISortByFunction<T> | keyof T)[] | ISortBy<T>[] | undefined,
): T[] => sort(values).desc(iteratees);

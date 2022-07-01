import { getType } from "./get-type";

export const isAsyncFunction = (value: unknown): boolean => getType(value) === "[object AsyncFunction]";

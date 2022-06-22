import { isAsyncFunction } from "./is-async-function";
import { isSyncFunction } from "./is-sync-function";

export const isFunction = (value: unknown): boolean => isSyncFunction(value) || isAsyncFunction(value);

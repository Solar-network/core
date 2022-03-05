import { isUndefined } from "./is-undefined";

export const isNil = (value: unknown): value is null | undefined => isUndefined(value) || value === null;

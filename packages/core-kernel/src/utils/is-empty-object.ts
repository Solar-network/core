import { isObject } from "./is-object";

export const isEmptyObject = (value: object): boolean => isObject(value) && Object.keys(value).length <= 0;

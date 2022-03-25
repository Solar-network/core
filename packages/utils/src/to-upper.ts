import { toString } from "./to-string";

export const toUpper = <T>(value: T): string => toString(value).toUpperCase();

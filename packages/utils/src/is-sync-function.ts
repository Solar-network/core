import { getType } from "./get-type";

export const isSyncFunction = (value: unknown): boolean => getType(value) === "[object Function]";

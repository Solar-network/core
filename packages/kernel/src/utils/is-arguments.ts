import { getType } from "./get-type";

export const isArguments = (value: unknown): boolean => getType(value) === "[object Arguments]";

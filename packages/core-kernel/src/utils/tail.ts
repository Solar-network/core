import { slice } from "./slice";

export const tail = <T>(values: T[]): T[] => slice(values, 1, values.length);

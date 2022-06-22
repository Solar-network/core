import { slice } from "./slice";

export const take = <T>(iterable: T[], amount: number = 1): T[] => slice(iterable, 0, amount);

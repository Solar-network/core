import { flatten } from "./flatten";
import { uniq } from "./uniq";

export const union = <T>(...args: T[]): T[] => uniq(flatten(args));

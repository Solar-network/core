import { filter } from "./filter";

export const pull = <T>(iterable: T[], ...args: any[]): T[] => filter(iterable, (item) => !args.includes(item)) as T[];

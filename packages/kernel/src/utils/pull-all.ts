import { pull } from "./pull";

export const pullAll = <T>(iterable: T[], iteratees: string[]): T[] => pull(iterable, ...iteratees);

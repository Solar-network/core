import { isBetween } from "./is-between";

export const isNotBetween = (value: number, a: number, b: number): boolean => !isBetween(value, a, b);

import { isMap } from "./is-map";

export const isEmptyMap = <K, V>(value: Map<K, V>): boolean => isMap(value) && value.size <= 0;

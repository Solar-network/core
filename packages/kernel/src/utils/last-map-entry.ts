export const lastMapEntry = <K, V>(map: Map<K, V>): [K, V] => Array.from(map)[map.size - 1];

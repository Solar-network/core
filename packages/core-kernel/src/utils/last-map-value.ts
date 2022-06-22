import { lastMapEntry } from "./last-map-entry";

export const lastMapValue = <K, V>(map: Map<K, V>): V => lastMapEntry(map)[1];

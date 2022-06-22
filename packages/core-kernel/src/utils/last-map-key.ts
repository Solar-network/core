import { lastMapEntry } from "./last-map-entry";

export const lastMapKey = <K, V>(map: Map<K, V>): K => lastMapEntry(map)[0];

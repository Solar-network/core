import { get } from "./get";
import { mapObject } from "./map-object";

export const at = <T>(object: object, paths: string[]): T[] =>
    Object.values(mapObject(paths, (path: string) => get(object, path)));

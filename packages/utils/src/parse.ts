import { parse as bourne } from "@hapi/bourne";

export const parse = <T>(json: string): T => bourne(json);

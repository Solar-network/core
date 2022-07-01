import { URL } from "url";

export const isURL = (value: unknown): value is URL => value instanceof URL;

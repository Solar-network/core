import { chars } from "./chars";

const encode = (value: string): string =>
    chars(value)
        .map((character: string) => character.charCodeAt(0).toString(2))
        .join(" ");

const decode = (value: string): string =>
    value
        .split(" ")
        .map((character: string) => String.fromCharCode(parseInt(character, 2)))
        .join("");

export const binary = { encode, decode };

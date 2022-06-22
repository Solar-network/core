import { readFileSync } from "fs";
import { Primitive } from "type-fest";

import { isString } from "./is-string";

const parse = (contents: string): Record<string, Primitive> => {
    const result: Record<string, Primitive> = {};

    for (const line of contents.toString().split("\n")) {
        const matches: RegExpExecArray | null = new RegExp(/^([^=:#]+?)[=:](.*)/).exec(line);

        if (!matches) {
            continue;
        }

        const key: string = matches[1].trim();
        const value: string = matches[2].replace(/^"(.*)"$/, "$1").trim();

        if (key && value) {
            if (new RegExp(/^\d+$/).test(value)) {
                result[key] = Number(value);
            } else if (["true", "false"].includes(value)) {
                result[key] = value === "true";
            } else {
                result[key] = value;
            }
        }
    }

    return result;
};

const parseFile = (file: string): Record<string, Primitive> => {
    return parse(readFileSync(file).toString());
};

const stringify = (pairs: object): string => {
    const contents: string[] = [];

    for (const key of Object.keys(pairs).filter(Boolean)) {
        const value: string = pairs[key];

        contents.push(isString(value) ? `${key}="${value}"` : `${key}=${value}`);
    }

    return contents.join("\n");
};

export const dotenv = { parse, parseFile, stringify };

import { Ajv } from "ajv";

import { isValidPeer } from "../utils";

const memo = (ajv: Ajv): void => {
    ajv.addFormat("memo", (data) => {
        try {
            return Buffer.from(data, "utf8").length <= 255;
        } catch {
            return false;
        }
    });
};

const validPeer = (ajv: Ajv): void => {
    ajv.addFormat("peer", (ip: string) => {
        try {
            return isValidPeer({ ip }, false);
        } catch {
            return false;
        }
    });
};

export const formats = [memo, validPeer];

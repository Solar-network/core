import { base58 } from "bstring";
import moize from "fast-memoize";

import { HashAlgorithms } from "../crypto";
import { Cache } from "./cache";

const encodeCheck = (buf: Buffer): string => {
    const checksum: Buffer = HashAlgorithms.hash256(buf);

    return base58.encode(Buffer.concat([buf, checksum], buf.length + 4));
};

const decodeCheck = (address: string): Buffer => {
    const buf: Buffer = base58.decode(address);
    const payload: Buffer = buf.slice(0, -4);
    const checksum: Buffer = HashAlgorithms.hash256(payload);

    if (checksum.readUInt32LE(0) !== buf.slice(-4).readUInt32LE(0)) {
        throw new Error("Invalid checksum");
    }

    return payload;
};

export const Base58 = {
    encodeCheck: moize(encodeCheck, {
        cache: {
            create: () => {
                return new Cache<string, string>(10000);
            },
        },
    }),
    decodeCheck: moize(decodeCheck, {
        cache: {
            create: () => {
                return new Cache<string, Buffer>(10000);
            },
        },
    }),
};

import { randomBytes } from "crypto";

export const randomHex = (length: number): string =>
    randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);

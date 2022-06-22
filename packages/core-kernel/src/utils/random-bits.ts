import { randomBytes } from "crypto";

export const randomBits = (bits: number): Buffer => randomBytes(Math.ceil(bits / 8));

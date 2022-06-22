const encode = (value: string): string => Buffer.from(value).toString("base64");

const decode = (value: string): string => Buffer.from(value, "base64").toString();

export const base64 = { encode, decode };

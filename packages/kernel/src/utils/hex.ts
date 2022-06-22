const encode = (value: string): string => Buffer.from(value, "utf8").toString("hex");

const decode = (value: string): string => Buffer.from(value, "hex").toString();

export const hex = { encode, decode };

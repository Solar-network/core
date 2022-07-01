export const protocols = (value: string): string[] =>
    value.substring(0, value.indexOf("://")).split("+").filter(Boolean);

export const isMatch = (value: string, pattern: string | RegExp): boolean => new RegExp(pattern).test(value);

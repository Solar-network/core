export const isMatch = (value: any, pattern: string | RegExp): boolean => new RegExp(pattern).test(value);

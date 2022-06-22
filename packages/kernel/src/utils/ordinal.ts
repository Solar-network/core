const suffixes: string[] = ["th", "st", "nd", "rd"];

export const ordinal = (value: number): string => value + (suffixes[value % 100] || suffixes[0]);

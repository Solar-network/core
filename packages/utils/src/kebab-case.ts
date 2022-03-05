import { compoundWords } from "./internal";

export const kebabCase = (value: string): string | undefined =>
    compoundWords(value, (result: string, word: string, index: number) => result + (index ? "-" : "") + word);

import { compoundWords } from "./internal";
import { upperFirst } from "./upper-first";

export const camelCase = (value: string): string | undefined =>
    compoundWords(value, (result: string, word: string, index: number) => result + (index ? upperFirst(word) : word));

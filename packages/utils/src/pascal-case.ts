import { compoundWords } from "./internal";
import { upperFirst } from "./upper-first";

export const pascalCase = (value: string): string | undefined =>
    compoundWords(value, (result: string, word: string) => result + upperFirst(word));

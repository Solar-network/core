import { compoundWords } from "./internal";

export const upperCase = (value: string): string | undefined =>
    compoundWords(
        value,
        (result: string, word: string, index: number) => result + (index ? " " : "") + word.toUpperCase(),
    );

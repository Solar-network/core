import { mapArray } from "../map-array";
import { reduceArray } from "../reduce-array";
import { words } from "../words";

export const compoundWords = (
    value: string,
    transformer: (result: string, word: string, index: number) => string,
): string | undefined => {
    const segments: string[] | null = words(value);

    if (segments === null) {
        return undefined;
    }

    return reduceArray<string, string>(
        mapArray<string, string>(segments, (word: string) => word.toLowerCase()),
        transformer,
        "",
    );
};

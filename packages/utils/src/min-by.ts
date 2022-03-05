import { FunctionReturning } from "./internal";
import { mapArray } from "./map-array";

export const minBy = <T>(iterable: T[], iteratee: FunctionReturning): T => {
    const values: number[] = mapArray<T, number>(iterable, iteratee);

    let index: number = 0;
    let smallest: number = values[index];

    for (let i = 0; i < values.length; i++) {
        if (values[i] < smallest) {
            smallest = values[i];
            index = i;
        }
    }

    return iterable[index];
};

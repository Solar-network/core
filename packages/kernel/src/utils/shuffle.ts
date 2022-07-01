import { cloneArray } from "./clone-array";

export const shuffle = <T>(iterable: T[]): T[] => {
    const shuffledValues: T[] = cloneArray<T>(iterable);

    for (let i = 0; i < shuffledValues.length; i++) {
        const rand: number = Math.floor(Math.random() * (i + 1));
        const value: T = shuffledValues[i];

        shuffledValues[i] = shuffledValues[rand];
        shuffledValues[rand] = value;
    }

    return shuffledValues;
};

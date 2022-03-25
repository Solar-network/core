export const cloneArray = <T>(input: T[]): T[] => {
    const sliced = new Array(input.length);

    for (let i = 0; i < input.length; i++) {
        sliced[i] = input[i];
    }

    return sliced;
};

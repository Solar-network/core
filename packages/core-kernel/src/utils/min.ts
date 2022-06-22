export const min = (values: number[]): number => {
    let min: number = values[0];

    for (let i = 0; i < values.length; i++) {
        const value: number = values[i];

        min = value < min ? value : min;
    }

    return min;
};

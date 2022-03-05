export const max = (values: number[]): number => {
    let max: number = values[0];

    for (let i = 0; i < values.length; i++) {
        const value: number = values[i];

        max = value > max ? value : max;
    }

    return max;
};

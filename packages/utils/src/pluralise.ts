export const pluralise = (value: string, count: number = 1, inclusive: boolean = false): string => {
    let output: string = value;

    if (count !== 1) {
        output += "s";
    }

    return inclusive ? `${count} ${output}` : output;
};

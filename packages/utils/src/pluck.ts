export const pluck = <T>(input: T[], field: string): T[] => {
    const plucked: T[] = [];

    let count: number = 0;

    for (let i = 0; i < input.length; i++) {
        const value = input[i];

        if (value != null && value[field] !== undefined) {
            plucked[count++] = value[field];
        }
    }

    return plucked;
};

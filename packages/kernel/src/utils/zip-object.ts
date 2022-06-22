export const zipObject = <V>(keys: string[] | number[], values: V[]): Record<string | number, V> => {
    const result: Record<string | number, V> = {};

    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = values[i];
    }

    return result;
};

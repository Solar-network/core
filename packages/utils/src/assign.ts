export const assign = <T>(target: T, ...sources: any[]): T => {
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const keys = Object.keys(source);

        for (let j = 0; j < keys.length; j++) {
            const key = keys[j];

            target[key] = source[key];
        }
    }

    return target;
};

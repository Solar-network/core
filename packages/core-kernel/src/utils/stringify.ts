export const stringify = (object: object): string => {
    const keys: any = [];
    const seen: object = {};
    JSON.stringify(object, (key, value) => {
        if (!(key in seen)) {
            keys.push(key);
            seen[key] = undefined;
        }
        return value;
    });
    keys.sort();
    return JSON.stringify(object, keys);
};

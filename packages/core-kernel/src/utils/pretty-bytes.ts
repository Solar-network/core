const UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

export const prettyBytes = (bytes: number): string => {
    if (bytes === 0 || bytes < 1) {
        return `${bytes} ${UNITS[0]}`;
    }

    const exponent: number = Math.min(Math.floor(Math.log10(bytes) / 3), UNITS.length - 1);

    return Number((bytes / Math.pow(1000, exponent)).toPrecision(3)).toLocaleString() + " " + UNITS[exponent];
};

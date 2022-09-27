import { bgRed, blue, gray, green, red, reset, white, yellow } from "colorette";
export const logColour = (level: string): Function => {
    switch (level) {
        case "info":
            return green;
        case "debug":
            return blue;
        case "trace":
            return gray;
        case "warning":
            return yellow;
        case "error":
            return red;
        case "critical":
            return (output: string | number) => {
                return bgRed(white(output));
            };
    }
    return reset;
};

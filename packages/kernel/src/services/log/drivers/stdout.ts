import { cyan, magenta } from "colorette";
import dateformat from "dateformat";
import { once } from "events";
import build from "pino-abstract-transport";
import SonicBoom from "sonic-boom";

import { Services, Utils } from "../../..";

export default async () => {
    const destination = new SonicBoom({ dest: 1, sync: false });
    await once(destination, "ready");

    const levelsByName: Record<string, number> = {};
    const levelsByNumber: Record<number, string> = {};

    for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
        if (!isNaN(+value)) {
            levelsByName[key.toLowerCase()] = +value;
            levelsByNumber[+value] = key.toLowerCase();
        }
    }

    const logLevel: number = levelsByName[process.env.SOLAR_CORE_LOG_LEVEL ?? "debug"];

    return build(
        async function (source) {
            for await (const obj of source) {
                const { emoji, level, message, pkg, time } = obj;
                if (level > logLevel) {
                    continue;
                }

                const levelText = levelsByNumber[level];
                const colour = Utils.logColour(levelText);

                const toDrain = !destination.write(
                    `${magenta(pkg.toLowerCase().substring(0, 16).padEnd(17))}${cyan(
                        dateformat(new Date(time), "yyyy-mm-dd HH:MM:ss.l"),
                    )} ${colour(`[${levelText.toUpperCase().slice(0, 1)}]`)} ${
                        process.env.SOLAR_CORE_LOG_EMOJI_DISABLED?.toLowerCase() !== "true" ? `${emoji}\t` : ""
                    }${colour(message)}\n`,
                );

                if (toDrain) {
                    await once(destination, "drain");
                }
            }
        },
        {
            async close() {
                destination.end();
                await once(destination, "close");
            },
        },
    );
};

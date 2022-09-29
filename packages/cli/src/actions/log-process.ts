import { Services, Utils } from "@solar-network/kernel";
import { bold, cyan, gray, magenta } from "colorette";
import dateformat from "dateformat";
import { parseFileSync } from "envfile";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { Tail } from "tail";

import { Application } from "../application";
import { Identifiers, inject, injectable } from "../ioc";
import { Environment } from "../services";

@injectable()
export class LogProcess {
    @inject(Identifiers.Application)
    private readonly app!: Application;

    @inject(Identifiers.Environment)
    private readonly environment!: Environment;

    private emoji: boolean = true;
    private levels: Record<string, number> = {};

    private logLevel: number = this.levels["debug"];

    /**
     * @param {string[]} processes
     * @param {number} lines
     * @returns {Promise<void>}
     * @memberof Log
     */
    public async execute(token: string, network: string, processes: string[], lines: number): Promise<void> {
        for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
            if (!isNaN(+value)) {
                this.levels[key.toLowerCase()] = +value;
            }
        }

        if (process.env.SOLAR_CORE_LOG_EMOJI_DISABLED !== undefined) {
            this.emoji = process.env.SOLAR_CORE_LOG_EMOJI_DISABLED.toLowerCase() !== "true";
        }

        if (this.levels[process.env.SOLAR_CORE_LOG_LEVEL!] !== undefined) {
            this.logLevel = this.levels[process.env.SOLAR_CORE_LOG_LEVEL!];
        }

        try {
            const env: Record<string, string> = parseFileSync(this.app.getCorePath("config", ".env"));
            if (
                process.env.SOLAR_CORE_LOG_EMOJI_DISABLED === undefined &&
                env.SOLAR_CORE_LOG_EMOJI_DISABLED !== undefined
            ) {
                this.emoji = env.SOLAR_CORE_LOG_EMOJI_DISABLED.toLowerCase() !== "true";
            }

            if (
                this.levels[process.env.SOLAR_CORE_LOG_LEVEL!] === undefined &&
                this.levels[env.SOLAR_CORE_LOG_LEVEL] !== undefined
            ) {
                this.logLevel = this.levels[env.SOLAR_CORE_LOG_LEVEL];
            }
        } catch {
            //
        }

        const logPath: string = join(this.environment.getPaths(token, network).log);
        if (!existsSync(logPath) || !statSync(logPath).isDirectory()) {
            throw new Error(`The ${logPath} directory is not valid`);
        }

        const tails: Record<string, Tail>[] = [];

        for (const proc of processes) {
            const outFile = `${logPath}/${token}-${network}-${proc}-current.log`;
            if (existsSync(outFile) && statSync(outFile).isFile()) {
                const lastLines = this.readLastLines(proc, outFile, lines);
                if (lastLines) {
                    console.log(
                        gray(
                            `Showing the last ${lines} lines of the ${bold(
                                proc,
                            )} output log (change the number of lines with the --lines option):`,
                        ),
                    );
                    console.log();
                    console.log(lastLines);
                    console.log();
                }

                tails.push({ process: proc, tail: new Tail(outFile) });
            }
        }

        if (tails.length > 0) {
            console.log(gray("New log entries will appear below:"));
            console.log();

            for (const { process, tail } of tails) {
                tail.on("line", (line: string) => {
                    const output: string | undefined = this.parse(line);
                    if (output) {
                        console.error(this.addProcessName(process, output));
                    }
                });
                tail.watch();
            }
        } else {
            throw new Error(`No ${processes.join(", ")} log files were found in ${logPath}`);
        }
    }

    private addProcessName(process: string, line: string): string {
        return `${magenta(process.padEnd(9))}${line}`;
    }

    private parse(line: string): string | undefined {
        const { emoji, level, message, time } = JSON.parse(line);

        if (this.levels[level] > this.logLevel) {
            return;
        }

        const colour = Utils.logColour(level);

        return `${cyan(dateformat(new Date(time), "yyyy-mm-dd HH:MM:ss.l"))} ${colour(
            `[${level.toUpperCase().slice(0, 1)}]`,
        )} ${this.emoji ? `${emoji}\t` : ""}${colour(message)}`;
    }

    private readLastLines(process: string, file: string, lines: number): string {
        try {
            return readFileSync(file)
                .toString()
                .split("\n")
                .slice(lines * -1 - 1)
                .filter((line) => line.length > 0)
                .map((line) => {
                    const output: string | undefined = this.parse(line);
                    if (output) {
                        return this.addProcessName(process, output);
                    }
                    return undefined;
                })
                .filter((line) => line)
                .join("\n")
                .trim();
        } catch {
            return "";
        }
    }
}

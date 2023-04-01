import { Services, Utils } from "@solar-network/kernel";
import { bold, cyan, gray, magenta } from "colorette";
import dateformat from "dateformat";
import delay from "delay";
import { parseFileSync } from "envfile";
import { EventEmitter } from "events";
import { closeSync, existsSync, openSync, read, readSync, statSync, watch } from "fs";
import { join } from "path";

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
    private levelsByName: Record<string, number> = {};
    private levelsByNumber: Record<number, string> = {};

    private logLevel!: number;

    /**
     * @param {string[]} processes
     * @param {number} lines
     * @returns {Promise<void>}
     * @memberof Log
     */
    public async execute(token: string, network: string, processes: string[], lines: number): Promise<void> {
        for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
            if (!isNaN(+value)) {
                this.levelsByName[key.toLowerCase()] = +value;
                this.levelsByNumber[+value] = key.toLowerCase();
            }
        }

        if (process.env.SOLAR_CORE_LOG_EMOJI_DISABLED !== undefined) {
            this.emoji = process.env.SOLAR_CORE_LOG_EMOJI_DISABLED.toLowerCase() !== "true";
        }

        if (this.levelsByName[process.env.SOLAR_CORE_LOG_LEVEL!] !== undefined) {
            this.logLevel = this.levelsByName[process.env.SOLAR_CORE_LOG_LEVEL!];
        } else {
            this.logLevel = this.levelsByName["debug"];
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
                this.levelsByName[process.env.SOLAR_CORE_LOG_LEVEL!] === undefined &&
                this.levelsByName[env.SOLAR_CORE_LOG_LEVEL] !== undefined
            ) {
                this.logLevel = this.levelsByName[env.SOLAR_CORE_LOG_LEVEL];
            }
        } catch {
            //
        }

        const logPath: string = join(this.environment.getPaths(token, network).log);
        if (!existsSync(logPath) || !statSync(logPath).isDirectory()) {
            throw new Error(`The ${logPath} directory is not valid`);
        }

        const watchers: { process: string; watcher: Watcher }[] = [];

        for (const proc of processes) {
            const outFile = `${logPath}/${token}-${network}-${proc}-current.log`;
            if (existsSync(outFile) && statSync(outFile).isFile()) {
                const lastLines = await this.readLastLines(proc, outFile, lines);
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

                watchers.push({ process: proc, watcher: new Watcher(outFile) });
            }
        }

        if (watchers.length > 0) {
            console.log(gray("New log entries will appear below:"));
            console.log();

            for (const { watcher } of watchers) {
                watcher.on("log", (line: string) => {
                    const output: string | undefined = this.parse(line);
                    if (output) {
                        console.error(output);
                    }
                });
                watcher.start();
            }
        } else {
            throw new Error(`No ${processes.join(", ")} log files were found in ${logPath}`);
        }
    }

    private parse(line: string): string | undefined {
        const { emoji, level, message, pkg, time } = JSON.parse(line);

        if (level > this.logLevel) {
            return;
        }

        const levelText = this.levelsByNumber[level];
        const colour = Utils.logColour(levelText);

        return `${magenta(pkg.toLowerCase().substring(0, 16).padEnd(17))}${cyan(
            dateformat(new Date(time), "yyyy-mm-dd HH:MM:ss.l"),
        )} ${colour(`[${levelText.toUpperCase().slice(0, 1)}]`)} ${this.emoji ? `${emoji}\t` : ""}${colour(message)}`;
    }

    private async readLastLines(process: string, file: string, lines: number): Promise<string> {
        try {
            return new Promise<string>((resolve) => {
                const lineBuffer: string[] = [];
                let chunk: string = "";
                const chunkSize: number = 64 * 1024;
                let position: number = 0;
                const { size } = statSync(file);
                position = size - chunkSize;

                const readChunk = (): void => {
                    if (position < 0) {
                        position = 0;
                    }

                    const buffer: Buffer = Buffer.alloc(chunkSize);
                    let proceed: boolean = true;

                    read(
                        descriptor,
                        buffer,
                        0,
                        chunkSize,
                        position,
                        (error: NodeJS.ErrnoException | null, bytesRead: number, buffer: Buffer) => {
                            if (error) {
                                resolve("");
                                return;
                            }

                            chunk = buffer.slice(0, bytesRead).toString() + chunk;

                            while (proceed) {
                                const index: number = chunk.lastIndexOf("\n");
                                if (index < 0 || lineBuffer.length >= lines) {
                                    proceed = false;
                                    break;
                                }

                                const line = chunk.slice(index + 1);
                                chunk = chunk.slice(0, index);

                                if (line && line.trim() !== "") {
                                    lineBuffer.unshift(line);
                                }
                            }

                            if (position === 0 || lineBuffer.length >= lines) {
                                resolve(
                                    lineBuffer
                                        .map((line) => {
                                            return this.parse(line);
                                        })
                                        .filter((line) => line)
                                        .join("\n")
                                        .trim(),
                                );
                            } else {
                                position -= chunkSize;
                                readChunk();
                            }
                        },
                    );
                };

                const descriptor = openSync(file, "r");
                readChunk();
            });
        } catch {
            return "";
        }
    }
}

class Watcher extends EventEmitter {
    private file: string;

    public constructor(file: string) {
        super();
        this.file = file;
    }

    public async start(): Promise<void> {
        let incompleteLine: string = "";
        let { size } = statSync(this.file);
        watch(this.file, async (eventType) => {
            if (eventType === "change") {
                while (!existsSync(this.file)) {
                    await delay(100);
                    size = 0;
                }
                const stats = statSync(this.file);

                if (stats.size < size) {
                    size = 0;
                }

                if (stats.size > size) {
                    const buffer = Buffer.alloc(stats.size - size);
                    const fileDescriptor = openSync(this.file, "r");
                    readSync(fileDescriptor, buffer, 0, buffer.length, size);
                    closeSync(fileDescriptor);

                    size = stats.size;

                    const data = incompleteLine + buffer.toString();
                    const lines = data.split("\n");
                    incompleteLine = lines.pop() ?? "";

                    for (const line of lines) {
                        if (line) {
                            this.emit("log", line);
                        }
                    }
                }
            }
        });
    }
}

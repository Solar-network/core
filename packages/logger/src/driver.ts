import { Container, Contracts, Utils } from "@solar-network/kernel";
import { createColors } from "colorette";
import * as console from "console";
import pino from "pino";
import { prettyFactory } from "pino-pretty";
import pump from "pump";
import { createStream } from "rotating-file-stream";
import split from "split2";
import { PassThrough, Transform, Writable } from "stream";
import { inspect } from "util";
const { bgRed, blue, cyan, gray, green, red, white, yellow } = createColors({ useColor: true });

/**
 * @export
 * @class PinoLogger
 * @implements {Contracts.Kernel.Logger}
 */
@Container.injectable()
export class PinoLogger implements Contracts.Kernel.Logger {
    /**
     * @private
     * @type {Contracts.Kernel.Application}
     * @memberof PinoLogger
     */
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.ConfigFlags)
    private readonly configFlags!: { processType: string };

    /**
     * @private
     * @type {PassThrough}
     * @memberof PinoLogger
     */
    private stream!: PassThrough;

    /**
     * @private
     * @type {Writable}
     * @memberof PinoLogger
     */
    private combinedFileStream?: Writable;

    /**
     * @private
     * @type {pino.Logger}
     * @memberof PinoLogger
     */
    private logger!: pino.Logger;

    /**
     * @private
     * @type {boolean}
     * @memberof PinoLogger
     */
    private silentConsole: boolean = false;

    /**
     * @param {*} options
     * @returns {Promise<Contracts.Kernel.Logger>}
     * @memberof PinoLogger
     */
    public async make(options?: any): Promise<Contracts.Kernel.Logger> {
        this.stream = new PassThrough();
        this.logger = pino(
            {
                base: undefined,
                customLevels: {
                    critical: 0,
                    error: 1,
                    warning: 2,
                    info: 3,
                    debug: 4,
                    trace: 5,
                },
                level: "critical",
                formatters: {
                    level(level) {
                        return { level };
                    },
                },
                useOnlyCustomLevels: true,
            },
            this.stream,
        );

        if (this.isValidLevel(options.logLevel)) {
            const prettyPinoFactory = prettyFactory({
                translateTime: "yyyy-mm-dd HH:MM:ss.l",
                include: "level,time",
                messageFormat: (log) => {
                    let colour!: Function;
                    let emoji: string = log.emoji as string;

                    const level: string = log.level as string;

                    switch (level) {
                        case "info":
                            colour = green;
                            if (!emoji) {
                                emoji = "ℹ️";
                            }
                            break;
                        case "debug":
                            colour = blue;
                            if (!emoji) {
                                emoji = "🐛";
                            }
                            break;
                        case "trace":
                            colour = gray;
                            if (!emoji) {
                                emoji = "📌";
                            }
                            break;
                        case "warning":
                            colour = yellow;
                            if (!emoji) {
                                emoji = "⚠️";
                            }
                            break;
                        case "error":
                            colour = red;
                            if (!emoji) {
                                emoji = "🛑";
                            }
                            break;
                        case "critical":
                            colour = (output: string | number) => {
                                return bgRed(white(output));
                            };
                            if (!emoji) {
                                emoji = "🚨";
                            }
                            break;
                    }
                    return `\b\b ${colour(`[${level.toUpperCase().slice(0, 1)}]`)} ${emoji}\t${colour(log.msg)}`;
                },
                customPrettifiers: {
                    level: (): string => "",
                    time: (timestamp): string => cyan(timestamp as string),
                },
            });

            pump(
                this.stream,
                split(),
                this.createPrettyTransport(options.logLevel, prettyPinoFactory),
                process.stdout,
                (err) => {
                    console.error("Output stream closed due to an error:", err);
                },
            );
        }

        this.combinedFileStream = this.getFileStream(options.fileRotator);

        this.combinedFileStream!.on("error", (err) => {
            console.error("File stream closed due to an error:", err);
        });

        this.stream.pipe(this.combinedFileStream!);

        return this;
    }

    public critical(message: object, emoji?: string): void {
        this.log("critical", message, emoji);
    }

    public error(message: object, emoji?: string): void {
        this.log("error", message, emoji);
    }

    public warning(message: object, emoji?: string): void {
        this.log("warning", message, emoji);
    }

    public info(message: object, emoji?: string): void {
        this.log("info", message, emoji);
    }

    public debug(message: object, emoji?: string): void {
        this.log("debug", message, emoji);
    }

    public trace(message: object, emoji?: string): void {
        this.log("trace", message, emoji);
    }

    /**
     * @param {boolean} suppress
     * @memberof PinoLogger
     */
    public suppressConsoleOutput(suppress: boolean): void {
        this.silentConsole = suppress;
    }

    public async dispose(): Promise<void> {
        if (this.combinedFileStream) {
            this.stream.unpipe(this.combinedFileStream);

            if (!this.combinedFileStream.destroyed) {
                this.combinedFileStream.end();

                return new Promise((resolve) => {
                    this.combinedFileStream!.on("finish", () => {
                        resolve();
                    });
                });
            }
        }
    }

    /**
     * @private
     * @param {string} level
     * @param {PrettyOptions} [prettyOptions]
     * @returns {Transform}
     * @memberof PinoLogger
     */
    private createPrettyTransport(level: string, prettyFactory: Function): Transform {
        const getLevel = (level: string): number => this.logger.levels.values[level];

        return new Transform({
            transform(chunk, enc, cb) {
                try {
                    const json = JSON.parse(chunk);

                    if (getLevel(json.level) <= getLevel(level)) {
                        const line: string | undefined = prettyFactory(json);
                        if (line !== undefined) {
                            return cb(undefined, line);
                        }
                    }
                } catch {}

                return cb();
            },
        });
    }

    /**
     * @param {string} level
     * @param {*} message
     * @returns {boolean}
     * @memberof Logger
     */
    private log(level: string, message: string | object, emoji?: string): void {
        if (this.silentConsole) {
            return;
        }

        if (Utils.isEmpty(message)) {
            return;
        }

        if (typeof message !== "string") {
            message = inspect(message, { depth: 1 });
        }

        this.logger.child({ emoji })[level](message);
    }

    /**
     * @private
     * @param {{ interval: string }} options
     * @returns {Writable}
     * @memberof PinoLogger
     */
    private getFileStream(options: { interval: string }): Writable {
        return createStream(
            (time: number | Date, index?: number): string => {
                if (!time) {
                    return `${this.app.namespace()}-${this.configFlags.processType}-current.log`;
                }

                if (typeof time === "number") {
                    time = new Date(time);
                }

                let filename: string = time.toISOString().slice(0, 10);

                if (index && index > 1) {
                    filename += `.${index}`;
                }

                return `${this.app.namespace()}-${this.configFlags.processType}-${filename}.log.gz`;
            },
            {
                path: this.app.logPath(),
                initialRotation: true,
                interval: options.interval,
                maxSize: "100M",
                maxFiles: 10,
                compress: "gzip",
            },
        );
    }

    /**
     * @private
     * @param {string} level
     * @returns {boolean}
     * @memberof PinoLogger
     */
    private isValidLevel(level: string): boolean {
        return ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug", "trace"].includes(
            level,
        );
    }
}

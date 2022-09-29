import { Container, Contracts, Services, Utils } from "@solar-network/kernel";
import pino from "pino";
import pump from "pump";
import split from "split2";
import { PassThrough, Transform } from "stream";
import { inspect } from "util";

@Container.injectable()
export class PinoLogger implements Contracts.Kernel.Logger {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.ConfigFlags)
    private readonly configFlags!: { processType: string };

    private logger!: pino.Logger;

    public async make(): Promise<Contracts.Kernel.Logger> {
        let stream: PassThrough | undefined;
        let transport: pino.TransportSingleOptions<Record<string, any>> | undefined;
        if (["core", "forger", "relay"].includes(this.configFlags.processType)) {
            transport = {
                target: "pino/file",
                options: {
                    destination: `${this.app.logPath()}/${this.app.namespace()}-${
                        this.configFlags.processType
                    }-current.log`,
                },
            };
        } else {
            stream = new PassThrough();
        }

        const customLevels: Record<string, number> = {};
        for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
            if (!isNaN(+value)) {
                customLevels[key.toLowerCase()] = +value;
            }
        }

        this.logger = pino(
            {
                base: undefined,
                customLevels,
                level: "critical",
                formatters: {
                    level(level) {
                        return { level };
                    },
                },
                transport,
                useOnlyCustomLevels: true,
            },
            stream!,
        );

        if (stream) {
            pump(stream, split(), this.createPrettyTransport(), process.stdout, (err) => {
                console.error("Output stream closed due to an error:", err);
            });
        } else {
            console = {
                ...console,
                assert: (value, message) => {
                    if (!value) {
                        this.error(message ? "Assertion failed: " + message : "Assertion failed");
                    }
                },
                error: (message) => this.error(message),
                warn: (message) => this.warning(message),
                info: (message) => this.info(message),
                log: (message) => this.info(message),
                debug: (message) => this.debug(message),
                trace: (message) => this.trace(message),
            };
        }

        return this;
    }

    public critical(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "🚨";
        }
        this.log("critical", message, emoji);
    }

    public error(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "🛑";
        }
        this.log("error", message, emoji);
    }

    public warning(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "⚠️";
        }
        this.log("warning", message, emoji);
    }

    public info(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "ℹ️";
        }
        this.log("info", message, emoji);
    }

    public debug(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "🐛";
        }
        this.log("debug", message, emoji);
    }

    public trace(message: object | string | undefined, emoji?: string): void {
        if (!emoji) {
            emoji = "📌";
        }
        this.log("trace", message, emoji);
    }

    private createPrettyTransport(): Transform {
        const showEmoji: boolean = process.env.CORE_LOG_EMOJI_DISABLED?.toLowerCase() !== "true";
        return new Transform({
            transform(chunk, enc, cb) {
                try {
                    const { emoji, level, message } = JSON.parse(chunk);
                    return cb(undefined, `${showEmoji ? `${emoji} ` : ""}${Utils.logColour(level)(message)}\n`);
                } catch {
                    //
                }

                return cb();
            },
        });
    }

    private log(level: string, message: object | string | undefined, emoji?: string): void {
        if (Utils.isEmpty(message)) {
            return;
        }

        if (typeof message !== "string") {
            message = inspect(message, { depth: 1 });
        }

        this.logger[level]({ emoji, message });
    }
}

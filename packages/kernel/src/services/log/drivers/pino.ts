import envPaths, { Paths } from "env-paths";
import pino from "pino";
import { inspect } from "util";

import { Contracts, Services, Utils } from "../../..";
import { Identifiers, inject, injectable } from "../../../ioc";
import { KeyValuePair, Primitive } from "../../../types";
import { dotenv, set } from "../../../utils";

@injectable()
export class PinoLogger implements Contracts.Kernel.Logger {
    @inject(Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @inject(Identifiers.ConfigFlags)
    private readonly configFlags!: { daemon: boolean; processType: string };

    private logger!: pino.Logger;

    public async make(): Promise<Contracts.Kernel.Logger> {
        const customLevels: Record<string, number> = {};
        for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
            if (!isNaN(+value)) {
                customLevels[key.toLowerCase()] = +value;
            }
        }

        const { paths, token, network } = this.app.get<KeyValuePair>(Identifiers.ConfigFlags);
        const path: Paths = envPaths(token, { suffix: "core" });
        for (const [type] of Object.entries(path)) {
            if (["config", "log"].includes(type)) {
                const processPath: string | undefined = process.env[`SOLAR_CORE_PATH_${type.toUpperCase()}`];
                if (processPath) {
                    path[type] = processPath;
                } else if (paths?.[type]) {
                    path[type] = paths?.[type];
                } else {
                    path[type] = `${path[type]}/${network}`;
                }
            }
        }

        const config: Record<string, Primitive>[] = [dotenv.parseFile(`${path.config}/.env`)];
        config.forEach((configuration, index) => {
            for (const [key, value] of Object.entries(configuration)) {
                if (+index === 1 || process.env[key] === undefined) {
                    set(process.env, key, value);
                }
            }
        });

        const targets: pino.TransportTargetOptions[] = [
            {
                level: "critical",
                target: "pino/file",
                options: {
                    destination: `${path.log}/${token}-${network}-${this.configFlags.processType}-current.log`,
                },
            },
        ];

        if (!this.configFlags.daemon) {
            targets.unshift({ level: "critical", target: __dirname + "/stdout.js", options: {} });
        }

        this.logger = pino({
            base: undefined,
            customLevels,
            level: "critical",
            transport: {
                targets,
            },
            useOnlyCustomLevels: true,
        });

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

        process.once("SIGHUP", () => {
            this.make();
        });

        return this;
    }

    public critical(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "🚨";
        }
        this.log("critical", message, emoji, pkg);
    }

    public error(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "🛑";
        }
        this.log("error", message, emoji, pkg);
    }

    public warning(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "⚠️";
        }
        this.log("warning", message, emoji, pkg);
    }

    public info(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "ℹ️";
        }
        this.log("info", message, emoji, pkg);
    }

    public debug(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "🐛";
        }
        this.log("debug", message, emoji, pkg);
    }

    public trace(message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (!emoji) {
            emoji = "📌";
        }
        this.log("trace", message, emoji, pkg);
    }

    private log(level: string, message: object | string | undefined, emoji?: string, pkg: string = "console"): void {
        if (Utils.isEmpty(message)) {
            return;
        }

        if (typeof message !== "string") {
            message = inspect(message, { depth: 1 });
        }

        this.logger[level]({ emoji, message, pkg });
    }
}

import { isEmpty, prettyTime } from "@solar-network/utils";
import chalk, { Chalk } from "chalk";
import dayjs, { Dayjs } from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import utc from "dayjs/plugin/utc";
import { inspect } from "util";

import { Logger } from "../../../contracts/kernel/log";
import { injectable } from "../../../ioc";

dayjs.extend(advancedFormat);
dayjs.extend(utc);

@injectable()
export class MemoryLogger implements Logger {
    /**
     * @private
     * @type {Record<string, Chalk>}
     * @memberof MemoryLogger
     */
    private readonly levelStyles: Record<string, Chalk> = {
        emergency: chalk.bgRed,
        alert: chalk.red,
        critical: chalk.red,
        error: chalk.red,
        warning: chalk.yellow,
        notice: chalk.green,
        info: chalk.blue,
        debug: chalk.magenta,
    };

    /**
     * @private
     * @type {boolean}
     * @memberof MemoryLogger
     */
    private silentConsole: boolean = false;

    /**
     * @private
     * @type {Dayjs}
     * @memberof MemoryLogger
     */
    private lastTimestamp: Dayjs = dayjs().utc();

    /**
     * @param {*} [options]
     * @returns {Promise<Logger>}
     * @memberof MemoryLogger
     */
    public async make(options?: object): Promise<Logger> {
        return this;
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public emergency(message: object): void {
        this.log("emergency", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public alert(message: object): void {
        this.log("alert", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public critical(message: object): void {
        this.log("critical", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public error(message: object): void {
        this.log("error", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public warning(message: object): void {
        this.log("warning", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public notice(message: object): void {
        this.log("notice", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public info(message: object): void {
        this.log("info", message);
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public debug(message: object): void {
        this.log("debug", message);
    }

    /**
     * @param {boolean} suppress
     * @memberof MemoryLogger
     */
    public suppressConsoleOutput(suppress: boolean): void {
        this.silentConsole = suppress;
    }

    /**
     * Dispose logger.
     *
     * @returns {Promise<void>}
     * @memberof MemoryLogger
     */
    public async dispose(): Promise<void> {}

    /**
     * @private
     * @param {*} level
     * @param {*} message
     * @returns {void}
     * @memberof MemoryLogger
     */
    private log(level: string, message: object | string): void {
        if (this.silentConsole) {
            return;
        }

        if (isEmpty(message)) {
            return;
        }

        if (typeof message !== "string") {
            message = inspect(message, { depth: 1 });
        }

        level = level ? this.levelStyles[level](`[${level.toUpperCase()}] `) : "";

        const timestamp: string = dayjs.utc().format("YYYY-MM-DD HH:MM:ss.SSS");
        const timestampDiff: string = this.getTimestampDiff();

        process.stdout.write(`[${timestamp}] ${level}${message}${timestampDiff}\n`);
    }

    /**
     * @private
     * @returns {string}
     * @memberof MemoryLogger
     */
    private getTimestampDiff(): string {
        const diff: number = dayjs().diff(this.lastTimestamp);

        this.lastTimestamp = dayjs.utc();

        return chalk.yellow(` +${diff ? prettyTime(diff) : "0ms"}`);
    }
}

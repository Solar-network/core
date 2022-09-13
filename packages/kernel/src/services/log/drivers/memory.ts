import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import utc from "dayjs/plugin/utc";
import { inspect } from "util";

import { Logger } from "../../../contracts/kernel/log";
import { injectable } from "../../../ioc";
import { isEmpty } from "../../../utils";

dayjs.extend(advancedFormat);
dayjs.extend(utc);

@injectable()
export class MemoryLogger implements Logger {
    /**
     * @private
     * @type {boolean}
     * @memberof MemoryLogger
     */
    private silentConsole: boolean = false;

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
     * @param {*} message
     * @memberof MemoryLogger
     */
    public trace(message: object): void {
        this.log("trace", message);
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

        level = level ? `[${level.toUpperCase()}] ` : "";

        const timestamp: string = dayjs.utc().format("YYYY-MM-DD HH:MM:ss.SSS");

        process.stdout.write(`[${timestamp}] ${level}${message}\n`);
    }
}

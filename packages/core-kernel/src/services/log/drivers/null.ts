import { Logger } from "../../../contracts/kernel/log";
import { injectable } from "../../../ioc";

@injectable()
export class NullLogger implements Logger {
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
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public alert(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public critical(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public error(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public warning(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public notice(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public info(message: object): void {
        //
    }

    /**
     * @param {*} message
     * @memberof MemoryLogger
     */
    public debug(message: object): void {
        //
    }

    /**
     * @param {boolean} suppress
     * @memberof MemoryLogger
     */
    public suppressConsoleOutput(suppress: boolean): void {
        //
    }

    /**
     * Dispose logger.
     *
     * @returns {Promise<void>}
     * @memberof NullLogger
     */
    public async dispose(): Promise<void> {
        //
    }
}

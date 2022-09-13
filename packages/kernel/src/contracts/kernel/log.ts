/**
 * @remarks
 * This interface represents the {@link https://tools.ietf.org/html/rfc5424 | The Syslog Protocol}.
 *
 * @export
 * @interface Logger
 */
export interface Logger {
    /**
     * Create a new instance of the logger.
     *
     * @param {*} [options]
     * @returns {Promise<Logger>}
     * @memberof Logger
     */
    make(options?: any): Promise<Logger>;

    /**
     * Critical conditions.
     *
     * Example: Application component unavailable, unexpected exception.
     *
     * @param {*} message
     * @memberof Logger
     */
    critical(message: any, emoji?: string): void;

    /**
     * Runtime errors that do not require immediate action but should typically
     * be logged and monitored.
     *
     * @param {*} message
     * @memberof Logger
     */
    error(message: any, emoji?: string): void;

    /**
     * Exceptional occurrences that are not errors.
     *
     * Example: Use of deprecated APIs, poor use of an API, undesirable things
     * that are not necessarily wrong.
     *
     * @param {*} message
     * @memberof Logger
     */
    warning(message: any, emoji?: string): void;

    /**
     * Interesting events.
     *
     * Example: User logs in, SQL logs.
     *
     * @param {*} message
     * @memberof Logger
     */
    info(message: any, emoji?: string): void;

    /**
     * Detailed debug information.
     *
     * @param {*} message
     * @memberof Logger
     */
    debug(message: any, emoji?: string): void;

    /**
     * Detailed trace information.
     *
     * @param {*} message
     * @memberof Logger
     */
    trace(message: any, emoji?: string): void;

    /**
     * @param {boolean} suppress
     * @memberof Logger
     */
    suppressConsoleOutput(suppress: boolean): void;

    /**
     * Dispose logger.
     *
     * @returns {Promise<void>}
     * @memberof Logger
     */
    dispose(): Promise<void>;

    // /**
    //  * @param {Record<string,string>} levels
    //  * @memberof Logger
    //  */
    // setLevels(levels: Record<string, string>): void;
}

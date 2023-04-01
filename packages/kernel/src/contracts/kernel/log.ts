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
     * @returns {Promise<Logger>}
     * @memberof Logger
     */
    make(): Promise<Logger>;

    /**
     * Critical conditions.
     *
     * Example: Application component unavailable, unexpected exception.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    critical(message: object | string | undefined, emoji?: string, pkg?: string): void;

    /**
     * Runtime errors that do not require immediate action but should typically
     * be logged and monitored.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    error(message: object | string | undefined, emoji?: string, pkg?: string): void;

    /**
     * Exceptional occurrences that are not errors.
     *
     * Example: Use of deprecated APIs, poor use of an API, undesirable things
     * that are not necessarily wrong.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    warning(message: object | string | undefined, emoji?: string, pkg?: string): void;

    /**
     * Interesting events.
     *
     * Example: User logs in, SQL logs.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    info(message: object | string | undefined, emoji?: string, pkg?: string): void;

    /**
     * Detailed debug information.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    debug(message: object | string | undefined, emoji?: string, pkg?: string): void;

    /**
     * Detailed trace information.
     *
     * @param {object | string | undefined} message
     * @memberof Logger
     */
    trace(message: object | string | undefined, emoji?: string, pkg?: string): void;
}

import { injectable } from "../ioc";

/**
 * @enum {number}
 */
enum OutputVerbosity {
    Quiet = 0,
    Normal = 1,
    Verbose = 2,
    Debug = 3,
}

/**
 * @class Output
 */
@injectable()
export class Output {
    /**
     * @private
     * @type {number}
     * @memberof Output
     */
    private verbosity: number = OutputVerbosity.Normal;

    /**
     * @private
     * @type {Function}
     * @memberof Output
     */
    private realStdout: Function = process.stdout.write;

    /**
     * Mutes writing to stdout.
     *
     * @memberof Output
     */
    public mute(): void {
        (process.stdout as any).write = () => {};
    }

    /**
     * Unmutes writing to stdout.
     *
     * @memberof Output
     */
    public unmute(): void {
        (process.stdout as any).write = this.realStdout;
    }

    /**
     * Sets the verbosity of the output.
     *
     * @param {number} level
     * @memberof Output
     */
    public setVerbosity(level: number): void {
        this.verbosity = level;
    }

    /**
     * Gets the current verbosity of the output.
     *
     * @returns {number}
     * @memberof Output
     */
    public getVerbosity(): number {
        return this.verbosity;
    }

    /**
     * Returns whether the verbosity is quiet.
     *
     * @returns {boolean}
     * @memberof Output
     */
    public isQuiet(): boolean {
        return OutputVerbosity.Quiet === this.verbosity;
    }

    /**
     * Returns whether the verbosity is normal.
     *
     * @returns {boolean}
     * @memberof Output
     */
    public isNormal(): boolean {
        return OutputVerbosity.Normal === this.verbosity;
    }

    /**
     * Returns whether the verbosity is verbose.
     *
     * @returns {boolean}
     * @memberof Output
     */
    public isVerbose(): boolean {
        return OutputVerbosity.Verbose <= this.verbosity;
    }

    /**
     * Returns whether the verbosity is debug.
     *
     * @returns {boolean}
     * @memberof Output
     */
    public isDebug(): boolean {
        return OutputVerbosity.Debug <= this.verbosity;
    }
}

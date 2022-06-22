import { Identifiers, inject, injectable } from "../ioc";
import { ProcessManager } from "../services";

/**
 * @export
 * @class AbortMissingProcess
 */
@injectable()
export class AbortMissingProcess {
    /**
     * @private
     * @type {ProcessManager}
     * @memberof Command
     */
    @inject(Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    /**
     * @static
     * @param {string} processName
     * @memberof AbortMissingProcess
     */
    public execute(processName: string): void {
        if (this.processManager.missing(processName)) {
            throw new Error(`The "${processName}" process does not exist`);
        }
    }
}

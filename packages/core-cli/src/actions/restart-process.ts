import { Identifiers, inject, injectable } from "../ioc";
import { ProcessManager } from "../services";

/**
 * @export
 * @class RestartProcess
 */
@injectable()
export class RestartProcess {
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
     * @memberof RestartProcess
     */
    public execute(processName: string): void {
        try {
            this.processManager.restart(processName);
        } catch (error) {
            throw new Error(error.stderr ? `${error.message}: ${error.stderr}` : error.message);
        }
    }
}

import { Application } from "../application";
import { Spinner } from "../components";
import { AnyObject, ProcessOptions } from "../contracts";
import { Identifiers, inject, injectable } from "../ioc";
import { ProcessManager } from "../services";
import { AbortRunningProcess } from "./abort-running-process";
import { AbortUnknownProcess } from "./abort-unknown-process";

/**
 * @export
 * @class DaemoniseProcess
 */
@injectable()
export class DaemoniseProcess {
    /**
     * @private
     * @type {Application}
     * @memberof Command
     */
    @inject(Identifiers.Application)
    private readonly app!: Application;

    /**
     * @private
     * @type {ProcessManager}
     * @memberof Command
     */
    @inject(Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    /**
     * @static
     * @param {ProcessOptions} options
     * @param {*} flags
     * @memberof DaemoniseProcess
     */
    public async execute(options: ProcessOptions, flags: AnyObject): Promise<void> {
        const processName: string = options.name;

        if (this.processManager.has(processName)) {
            this.app.get<AbortRunningProcess>(Identifiers.AbortUnknownProcess).execute(processName);
            this.app.get<AbortUnknownProcess>(Identifiers.AbortRunningProcess).execute(processName);
        }

        const spinner = this.app.get<Spinner>(Identifiers.Spinner).render(`Starting ${processName}`);

        try {
            const flagsProcess: Record<string, boolean | number | string> = {
                "max-restarts": 5,
                "kill-timeout": 30000,
            };

            if (flags.daemon !== true) {
                flagsProcess["no-daemon"] = true;
            }

            flagsProcess.name = processName;

            spinner.start();

            await this.processManager.start(
                {
                    ...options,
                    ...{
                        env: {
                            NODE_ENV: "production",
                            SOLAR_CORE_ENV: flags.env,
                        },
                    },
                },
                flagsProcess,
            );

            spinner.succeed();
        } catch (error) {
            spinner.fail();
            throw new Error(error.stderr ? `${error.message}: ${error.stderr}` : error.message);
        }
    }
}

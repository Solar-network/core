import { Utils } from "@solar-network/kernel";
import dayjs from "dayjs";

import { AbortMissingProcess, AbortStoppedProcess, AbortUnknownProcess } from "../actions";
import { Application } from "../application";
import { Spinner, Table } from "../components";
import { ProcessDescription } from "../contracts";
import { Identifiers, inject, injectable } from "../ioc";
import { ProcessManager } from "../services";

/**
 * @export
 * @class Process
 */
@injectable()
export class Process {
    /**
     * @private
     * @type {Application}
     * @memberof ComponentFactory
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
     * @private
     * @type {string}
     * @memberof Process
     */
    private processName!: string;

    /**
     * @param {string} token
     * @param {string} suffix
     * @memberof Process
     */
    public initialise(processName: string): void {
        this.processName = processName;
    }

    /**
     * @param {boolean} daemon
     * @memberof Process
     */
    public async stop(daemon: boolean): Promise<void> {
        this.app.get<AbortMissingProcess>(Identifiers.AbortMissingProcess).execute(this.processName);
        this.app.get<AbortUnknownProcess>(Identifiers.AbortUnknownProcess).execute(this.processName);
        this.app.get<AbortStoppedProcess>(Identifiers.AbortStoppedProcess).execute(this.processName);

        const spinner = this.app.get<Spinner>(Identifiers.Spinner).render(`Stopping ${this.processName}`);

        spinner.start();

        await this.processManager[daemon ? "delete" : "stop"](this.processName);

        spinner.succeed();
    }

    /**
     * @memberof Process
     */
    public async restart(): Promise<void> {
        this.app.get<AbortMissingProcess>(Identifiers.AbortMissingProcess).execute(this.processName);
        this.app.get<AbortStoppedProcess>(Identifiers.AbortStoppedProcess).execute(this.processName);

        const spinner = this.app.get<Spinner>(Identifiers.Spinner).render(`Restarting ${this.processName}`);

        spinner.start();

        await this.processManager.restart(this.processName);

        spinner.succeed();
    }

    /**
     * @memberof Process
     */
    public status(): void {
        this.app.get<AbortMissingProcess>(Identifiers.AbortMissingProcess).execute(this.processName);

        this.app
            .get<Table>(Identifiers.Table)
            .render(["ID", "Name", "Version", "Status", "Uptime", "CPU", "RAM"], (table) => {
                const app: ProcessDescription | undefined = this.processManager.describe(this.processName);

                Utils.assert.defined<ProcessDescription>(app);

                table.push([
                    app.pid,
                    app.name,
                    app.pm2_env.version,
                    app.pm2_env.status,
                    Utils.prettyTime(dayjs().diff(app.pm2_env.pm_uptime)),
                    `${app.monit.cpu}%`,
                    Utils.prettyBytes(app.monit.memory),
                ]);
            });
    }
}

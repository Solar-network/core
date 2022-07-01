import { Commands, Container, Contracts, Services } from "@solar-network/cli";
import { Utils } from "@solar-network/kernel";
import dayjs from "dayjs";
import Joi from "joi";

/**
 * @export
 * @class Command
 * @extends {Commands.Command}
 */
@Container.injectable()
export class Command extends Commands.Command {
    /**
     * @private
     * @type {ProcessManager}
     * @memberof Command
     */
    @Container.inject(Container.Identifiers.ProcessManager)
    private readonly processManager!: Services.ProcessManager;

    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "top";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "List all Core daemons";

    /**
     * Indicates whether the command requires a network to be present.
     *
     * @type {boolean}
     * @memberof Command
     */
    public requiresNetwork: boolean = false;

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition.setFlag("token", "The name of the token", Joi.string().default("solar"));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const processes: Contracts.ProcessDescription[] = (this.processManager.list() || []).filter(
            (p: Contracts.ProcessDescription) => p.name.startsWith(this.getFlag("token")),
        );

        if (!processes || !Object.keys(processes).length) {
            this.components.fatal("No processes are running");
        }

        this.components.table(["ID", "Name", "Version", "Status", "Uptime", "CPU", "RAM"], (table) => {
            for (const process of processes) {
                table.push([
                    process.pid,
                    process.name,
                    process.pm2_env.version,
                    process.pm2_env.status,
                    Utils.prettyTime(dayjs().diff(process.pm2_env.pm_uptime)),
                    `${process.monit.cpu}%`,
                    Utils.prettyBytes(process.monit.memory),
                ]);
            }
        });
    }
}

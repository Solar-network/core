import { Commands, Container, Contracts } from "@solar-network/cli";
import { Utils } from "@solar-network/kernel";
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
     * @type {Contracts.Updater}
     * @memberof Command
     */
    @Container.inject(Container.Identifiers.Updater)
    private readonly updater!: Contracts.Updater;

    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "update";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Update the Core installation";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("force", "Force an update", Joi.boolean().default(false))
            .setFlag("updateProcessManager", "Update process manager", Joi.boolean().default(false))
            .setFlag("restart", "Restart all running processes", Joi.boolean())
            .setFlag("restartCore", "Restart the Core process", Joi.boolean())
            .setFlag("restartRelay", "Restart the Relay process", Joi.boolean())
            .setFlag("restartForger", "Restart the Forger process", Joi.boolean());
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (Utils.isInsideCoreDirectory()) {
            this.components.fatal("You can't update while inside the Core directory or one of its subdirectories");
        }

        const hasNewVersion: boolean = await this.updater.check();

        if (hasNewVersion) {
            await this.updater.update(this.getFlag("updateProcessManager"), this.getFlag("force"));

            if (this.hasRestartFlag()) {
                if (this.hasFlag("restart")) {
                    this.actions.restartRunningProcess("core");
                    this.actions.restartRunningProcess("relay");
                    this.actions.restartRunningProcess("forger");
                } else {
                    if (this.hasFlag("restartCore")) {
                        this.actions.restartRunningProcess("core");
                    }

                    if (this.hasFlag("restartRelay")) {
                        this.actions.restartRunningProcess("relay");
                    }

                    if (this.hasFlag("restartForger")) {
                        this.actions.restartRunningProcess("forger");
                    }
                }
            } else if (!this.getFlag("force")) {
                await this.actions.restartRunningProcessWithPrompt("core");
                await this.actions.restartRunningProcessWithPrompt("relay");
                await this.actions.restartRunningProcessWithPrompt("forger");
            }
        } else {
            this.components.success(`You already have the latest version (${this.pkg.version})`);
        }
    }

    /**
     * @private
     * @returns {boolean}
     * @memberof Command
     */
    private hasRestartFlag(): boolean {
        return Utils.hasSomeProperty(this.getFlags(), ["restart", "restartCore", "restartRelay", "restartForger"]);
    }
}

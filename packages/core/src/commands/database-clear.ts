import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { remove } from "fs-extra";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "database:clear";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Clear the database";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("force", "Force the database to be cleared", Joi.boolean())
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        this.actions.abortRunningProcess("core");
        this.actions.abortRunningProcess("relay");

        if (!this.getFlag("force")) {
            const confirmation: any = (
                await this.components.prompt({
                    type: "confirm",
                    name: "value",
                    message: "Clear the database to sync from zero on next startup?",
                })
            ).value;

            if (!confirmation) {
                throw new Error("You'll need to confirm the input to continue");
            }
        }

        await remove(this.app.getCorePath("data", "database"));
    }
}

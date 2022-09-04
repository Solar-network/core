import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { closeSync, openSync } from "fs";
import Joi from "joi";

/**
 * @export
 * @class Command
 * @extends {Commands.Command}
 */
@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "pool:clear";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Clear the pool of transactions";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("force", "Force the pool to be cleared", Joi.boolean())
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
        if (!this.getFlag("force")) {
            const confirmation: any = (
                await this.components.prompt({
                    type: "confirm",
                    name: "value",
                    message: "Clear all unconfirmed transactions from your pool on next startup?",
                })
            ).value;

            if (!confirmation) {
                throw new Error("You'll need to confirm the input to continue");
            }
        }

        try {
            closeSync(openSync(this.app.getCorePath("temp", "clear-pool.lock"), "w"));
        } catch {
            //
        }
    }
}

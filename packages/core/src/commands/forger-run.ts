import { Commands, Container, Contracts, Utils } from "@solar-network/core-cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { checkForPassphrase } from "../internal/crypto";

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
    public signature: string = "forger:run";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Run the Forger process in the foreground";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag("env", "", Joi.string().default("production"))
            .setFlag("bip39", "A delegate plain text passphrase. Referred to as BIP39", Joi.string())
            .setFlag("skipPrompts", "Skip prompts", Joi.boolean().default(false));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const flags: Contracts.AnyObject = { ...this.getFlags() };
        flags.processType = "forger";

        checkForPassphrase(this.app.getCorePath("config"));

        await Utils.buildApplication({
            flags,
            plugins: {
                "@solar-network/core-forger": {},
            },
        });

        // Prevent resolving execute method
        return new Promise(() => {});
    }
}

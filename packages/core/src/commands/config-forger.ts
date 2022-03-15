import { Commands, Container } from "@solar-network/core-cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Command as BIP39Command } from "./config-forger-bip39";

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
    public signature: string = "config:forger";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Configure the forging delegate";

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
            .setFlag("bip39", "A delegate plain text passphrase. Referred to as BIP39", Joi.string())
            .setFlag("skipValidation", "Skip BIP39 mnemonic validation", Joi.boolean().default(false));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        return await this.initializeAndExecute(BIP39Command);
    }

    private async initializeAndExecute(commandSignature): Promise<void> {
        const cmd = this.app.resolve<Commands.Command>(commandSignature);

        const flags = this.getFlags();
        cmd.configure();
        cmd.register([]);

        for (const flag in flags) {
            cmd.setFlag(flag, flags[flag]);
        }

        return await cmd.run();
    }
}

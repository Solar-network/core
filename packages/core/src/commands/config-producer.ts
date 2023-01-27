import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Command as BIP39Command } from "./config-producer-bip39";
import { Command as PrivateKeyCommand } from "./config-producer-private-key";

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
    public signature: string = "config:producer";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Configure the block producer";

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
            .setFlag("bip39", "A block producer plain text mnemonic, referred to as BIP39", Joi.string())
            .setFlag(
                "privateKey",
                "A 64 character hexadecimal block producer private key",
                Joi.string().hex().length(64),
            )
            .setFlag("skipValidation", "Skip BIP39 mnemonic validation", Joi.boolean().default(false))
            .setFlag(
                "method",
                'The configuration method to use ("bip39" or "privateKey")',
                Joi.string().valid(...["bip39", "privateKey"]),
            );
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (this.getFlag("method") === "bip39") {
            return await this.initialiseAndExecute(BIP39Command);
        }

        if (this.getFlag("method") === "privateKey") {
            return await this.initialiseAndExecute(PrivateKeyCommand);
        }

        let response = await this.components.prompt([
            {
                type: "select",
                name: "method",
                message: "Please select how you wish to enter your block producer private key?",
                choices: [
                    { title: "Hexadecimal private key", value: "privateKey" },
                    { title: "BIP39 mnemonic (Deprecated)", value: "bip39" },
                ],
            },
        ]);

        if (!response.method) {
            this.components.fatal("Please enter valid data and try again");
        }

        response = { ...this.getFlags(), ...response };

        if (response.method === "bip39") {
            return await this.initialiseAndExecute(BIP39Command);
        }

        if (response.method === "privateKey") {
            return await this.initialiseAndExecute(PrivateKeyCommand);
        }
    }

    private async initialiseAndExecute(commandSignature): Promise<void> {
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

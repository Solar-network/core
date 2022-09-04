import { Commands, Container, Contracts } from "@solar-network/cli";
import { Identities } from "@solar-network/crypto";
import { Networks } from "@solar-network/crypto";
import { validateMnemonic } from "bip39";
import { writeJsonSync } from "fs-extra";
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
    public signature: string = "config:forger:bip39";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Configure the forging delegate (BIP39)";

    /**
     * Indicates whether the command should be shown in the command list.
     *
     * @type {boolean}
     * @memberof Command
     */
    public isHidden: boolean = true;

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
            .setFlag("bip39", "A delegate plain text passphrase, referred to as BIP39", Joi.string())
            .setFlag("skipValidation", "Skip BIP39 mnemonic validation", Joi.boolean().default(false));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (this.hasFlag("bip39")) {
            return this.performConfiguration(this.getFlags());
        }

        const response = await this.components.prompt([
            {
                type: "password",
                name: "bip39",
                message: "Please enter your delegate plain text passphrase. Referred to as BIP39",
                validate: (value: string) =>
                    !validateMnemonic(value) && !this.getFlag("skipValidation")
                        ? `Failed to verify the given passphrase as BIP39 compliant`
                        : true,
            },
            {
                type: "confirm",
                name: "confirm",
                message: "Can you confirm?",
            },
        ]);

        if (response.confirm) {
            return this.performConfiguration({ ...this.getFlags(), ...response });
        }
    }

    /**
     * @private
     * @param {Contracts.AnyObject} flags
     * @returns {Promise<void>}
     * @memberof Command
     */
    private async performConfiguration(flags: Contracts.AnyObject): Promise<void> {
        await this.components.taskList([
            {
                title: "Validating passphrase is BIP39 compliant",
                task: () => {
                    if (!flags.bip39 || (!validateMnemonic(flags.bip39) && !flags.skipValidation)) {
                        throw new Error("Failed to verify the given passphrase as BIP39 compliant");
                    }
                },
            },
            {
                title: "Writing BIP39 passphrase to configuration",
                task: () => {
                    const delegatesConfig = this.app.getCorePath("config", "delegates.json");

                    const delegates: Record<string, string | string[]> = require(delegatesConfig);
                    delegates.keys = [Identities.PrivateKey.fromPassphrase(flags.bip39)];

                    writeJsonSync(delegatesConfig, delegates, { spaces: 4 });
                },
            },
        ]);
    }
}

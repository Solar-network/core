import { Commands, Container, Contracts } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
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
    public signature: string = "config:forger:private-key";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Configure the forging delegate (privateKey)";

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
            .setFlag("privateKey", "A 64 character hexadecimal delegate private key", Joi.string().hex().length(64));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (this.hasFlag("privateKey")) {
            return this.performConfiguration(this.getFlags());
        }

        const response = await this.components.prompt([
            {
                type: "password",
                name: "privateKey",
                message: "Please enter your 64 character hexadecimal delegate private key",
                validate: (value: string) =>
                    !/^[0-9a-fA-F]{64}$/.test(value) ? "The private key must be 64 hexadecimal characters" : true,
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
                title: "Writing private key to configuration",
                task: () => {
                    const delegatesConfig = this.app.getCorePath("config", "delegates.json");

                    const delegates: Record<string, string | string[]> = require(delegatesConfig);
                    delegates.keys = [flags.privateKey.toLowerCase()];

                    writeJsonSync(delegatesConfig, delegates, { spaces: 4 });
                },
            },
        ]);
    }
}

import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { Services } from "@solar-network/kernel";
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
    public signature: string[] = ["relay:log", "relay:logs", "log:relay", "logs:relay"];

    /**
     * The console commands to hide from the command list.
     *
     * @type {string[]}
     * @memberof Command
     */
    public hide: string[] = ["relay:logs", "logs:relay"];

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Display the Relay process log";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        const levels: string[] = [];

        for (const [key, value] of Object.entries(Services.Log.LogLevel)) {
            if (!isNaN(+value)) {
                levels.push(key.toLowerCase());
            }
        }

        this.definition
            .setFlag("emoji", "Show emoji in the log entries", Joi.boolean())
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag(
                "level",
                "The log level",
                Joi.string()
                    .valid(...levels)
                    .default(process.env.SOLAR_CORE_LOG_LEVEL ?? ""),
            )
            .setFlag("lines", "The number of lines to output", Joi.number().default(15).min(0).max(50000));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const emoji: boolean | undefined = this.getFlag("emoji");
        if (emoji !== undefined) {
            process.env.SOLAR_CORE_LOG_EMOJI_DISABLED = (!emoji).toString();
        }

        const level: string = this.getFlag("level");
        if (level !== "") {
            process.env.SOLAR_CORE_LOG_LEVEL = level;
        }

        await this.app
            .get<any>(Container.Identifiers.LogProcess)
            .execute(this.getFlag("token"), this.getFlag("network"), ["relay"], this.getFlag("lines"));
    }
}

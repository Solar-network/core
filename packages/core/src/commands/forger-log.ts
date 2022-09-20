import { Commands, Container } from "@solar-network/cli";
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
    public signature: string[] = ["forger:log", "forger:logs", "log:forger", "logs:forger"];

    /**
     * The console commands to hide from the command list.
     *
     * @type {string[]}
     * @memberof Command
     */
    public hide: string[] = ["forger:logs", "logs:forger"];

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Display the Forger process log";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("lines", "The number of lines to output", Joi.number().default(15));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        await this.app.get<any>(Container.Identifiers.LogProcess).execute(["forger"], this.getFlag("lines"));
    }
}

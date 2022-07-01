import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { readJsonSync, writeJsonSync } from "fs-extra";
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
    public signature: string = "config:log";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Update the logger configuration";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string())
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag("emojify", "Whether to add emoji to the logs of Core", Joi.boolean());
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (this.hasFlag("token")) {
            this.config.set("token", this.getFlag("token"));
        }

        if (this.hasFlag("emojify")) {
            const appJsonFile = this.app.getCorePath("config", "app.json");
            const appJson = readJsonSync(appJsonFile);

            for (const app of Object.keys(appJson)) {
                const loggerConfig = appJson[app].plugins.filter(
                    (plugin) => plugin.package === "@solar-network/logger",
                )[0];
                const emojify = this.getFlag("emojify");

                if (loggerConfig) {
                    if (loggerConfig.options) {
                        if (emojify) {
                            delete loggerConfig.options.emojify;
                        }
                    }

                    if (!emojify) {
                        if (!loggerConfig.options) {
                            loggerConfig.options = {};
                        }
                        loggerConfig.options.emojify = emojify;
                    }

                    if (Object.keys(loggerConfig.options).length === 0) {
                        delete loggerConfig.options;
                    }
                }
            }

            writeJsonSync(appJsonFile, appJson, { spaces: 4 });
        }
    }
}

import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Database from "better-sqlite3";
import copyFile from "cp-file";
import { existsSync, remove } from "fs-extra";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "database:restore";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Restore the database from a backup";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("force", "Force the database to be restored", Joi.boolean())
            .setFlag("height", "The height of the backup to use", Joi.number().required())
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

        const backup = this.app.getCorePath("data", `backups/${this.getFlag("height")}.db`);

        if (!existsSync(backup)) {
            throw new Error(`Database backup file ${backup} was not found`);
        }

        const database = new Database(backup, { timeout: 30000 });
        const height = +database.prepare("SELECT MAX(height) FROM blocks").pluck().get();
        database.close();

        if (!this.getFlag("force")) {
            const confirmation: any = (
                await this.components.prompt({
                    type: "confirm",
                    name: "value",
                    message: `Clear the database and restore to height ${height.toLocaleString()}?`,
                })
            ).value;

            if (!confirmation) {
                throw new Error("You'll need to confirm the input to continue");
            }
        }

        const spinner = this.components.spinner("Restoring the database (0.00% complete)");
        spinner.start();
        try {
            await remove(this.app.getCorePath("data", "database"));
            await copyFile(backup, this.app.getCorePath("data", "database/blockchain.db")).on("progress", (data) => {
                spinner.text = `Restoring the database (${(data.percent * 100).toFixed(2)}% complete)`;
            });

            spinner.succeed();
            this.components.log(`Restored the database to height ${height.toLocaleString()}`);
        } catch (error) {
            spinner.fail();
            this.components.error(error);
        }
    }
}

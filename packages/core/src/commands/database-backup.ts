import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Database from "better-sqlite3";
import execa from "execa";
import { existsSync, move, remove, statSync } from "fs-extra";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "database:backup";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Make a database backup";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
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
        const databasePath: string = this.app.getCorePath("data", "database/blockchain.db");

        if (!existsSync(databasePath)) {
            throw new Error("The database does not exist");
        }

        if (this.getFlag("backupPath")) {
            const database = new Database(databasePath, { timeout: 30000 });
            database.exec(`VACUUM INTO '${this.getFlag("backupPath")}'`);
            database.close();
            return;
        }

        const destination = this.app.getCorePath("temp", `${Date.now()}.db`);
        const spinner = this.components.spinner("Backing up the database (0.00% complete)");
        spinner.start();
        const params = [
            ...new Set([
                ...process.argv,
                ...Object.entries(this.getFlags()).map((flag) => `--${flag[0]}=${flag[1]}`),
                `--backupPath="${destination}"`,
            ]),
        ];
        const updateProgress = () => {
            if (existsSync(destination)) {
                const sourceSize = statSync(databasePath).size;
                const destinationSize = statSync(destination).size;
                const percent = (destinationSize / sourceSize) * 100;
                spinner.text = `Backing up the database (${percent.toFixed(2)}% complete)`;
            }
        };
        const interval = setInterval(() => updateProgress(), 50);
        updateProgress();
        try {
            await execa(params[0], params.slice(1), { shell: true });
            clearInterval(interval);
            spinner.text = "Backing up the database (100.00% complete)";
            spinner.succeed();
            const database = new Database(destination, { timeout: 30000 });
            const currentHeight = +database.prepare("SELECT MAX(height) FROM blocks").pluck().get();
            database.close();
            const path = this.app.getCorePath("data", `backups/${currentHeight}.db`);
            await remove(path);
            move(destination, path);
            this.components.log(
                `Backed up the database to height ${currentHeight.toLocaleString()} and saved it to ${path}`,
            );
        } catch (error) {
            await remove(destination);
            spinner.fail();
            this.components.error(error);
        }
    }
}

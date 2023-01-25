import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { Utils } from "@solar-network/kernel";
import Database, { Database as TDatabase } from "better-sqlite3";
import { existsSync } from "fs-extra";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "database:rollback";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Roll back the database by a number of blocks or to a specific height";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("force", "Force the database to be rolled back", Joi.boolean())
            .setFlag("blocks", "The number of blocks to roll back", Joi.number().min(1))
            .setFlag("height", "The height to roll back to", Joi.number().min(1))
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

        const databasePath: string = this.app.getCorePath("data", "database/blockchain.db");

        if (!existsSync(databasePath)) {
            throw new Error("The database does not exist");
        }

        if (this.hasFlag("height") && this.hasFlag("blocks")) {
            throw new Error("Please specify either a height or number of blocks to roll back, but not both");
        } else if (!this.hasFlag("height") && !this.hasFlag("blocks")) {
            throw new Error("Please specify either a height or number of blocks to roll back");
        }

        const database = new Database(databasePath, { timeout: 30000 });
        database.pragma("auto_vacuum = incremental");
        database.pragma("cache_size = 32768");
        database.pragma("journal_mode = wal");
        database.pragma("page_size = 32768");
        database.pragma("synchronous = normal");
        database.pragma("temp_store = memory");

        let height = +database.prepare("SELECT MAX(height) FROM blocks").pluck().get();

        let targetHeight: number;

        if (this.hasFlag("height")) {
            const requestedHeight: number = +this.getFlag("height");
            if (requestedHeight >= height) {
                throw new Error(
                    `Requested height ${requestedHeight.toLocaleString()} is not less than the current height ${height.toLocaleString()}`,
                );
            }

            targetHeight = requestedHeight;
        } else {
            const requestedHeight: number = height - +this.getFlag("blocks");
            if (requestedHeight < 1) {
                throw new Error(
                    `The maximum number of blocks that can be rolled back is ${(height - 1).toLocaleString()}`,
                );
            }

            targetHeight = requestedHeight;
        }

        const blocksToRemove: number = height - targetHeight;
        if (!this.getFlag("force")) {
            const confirmation: any = (
                await this.components.prompt({
                    type: "confirm",
                    name: "value",
                    message: `Remove ${Utils.pluralise(
                        "block",
                        blocksToRemove,
                        true,
                    )} and roll back the database to height ${targetHeight.toLocaleString()}?`,
                })
            ).value;

            if (!confirmation) {
                throw new Error("You'll need to confirm the input to continue");
            }
        }

        const spinner = this.components.spinner("Rolling back the database (0.00% complete)");
        spinner.start();
        try {
            const tables: string[] = database
                .prepare(
                    "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'transactions_%' AND name NOT LIKE '%_fts%'",
                )
                .pluck()
                .all();
            for (let i = height; i >= targetHeight; i = i - blocksToRemove / 10) {
                this.rollback(database, tables, i);
                const percent = ((blocksToRemove - (i - targetHeight)) / blocksToRemove) * 100;
                spinner.text = `Rolling back the database (${percent.toFixed(2)}% complete)`;
            }
            this.rollback(database, tables, targetHeight);
            spinner.text = `Rolling back the database (100.00% complete)`;
            spinner.succeed();
            height = +database.prepare("SELECT MAX(height) FROM blocks").pluck().get();
            this.components.log(`Rolled back the database to height ${height.toLocaleString()}`);
        } catch (error) {
            spinner.fail();
            this.components.error(error);
        }
        database.close();
    }

    private rollback(database: TDatabase, tables: string[], height: number) {
        const { round } = Utils.roundCalculator.calculateRound(height);
        database.pragma("foreign_keys = off");
        database.exec("BEGIN TRANSACTION");
        for (const table of tables) {
            database
                .prepare(
                    `DELETE FROM ${table}
                    WHERE transactions_row IN (SELECT row FROM transactions WHERE block_height > :height)`,
                )
                .run({ height });
        }
        database
            .prepare(
                `DELETE FROM balance_changes
                WHERE transactions_row IN (SELECT row FROM transactions WHERE block_height > :height)`,
            )
            .run({ height });
        database.prepare("DELETE FROM identities WHERE height > :height").run({ height });
        database.prepare("DELETE FROM public_keys WHERE height > :height").run({ height });
        database.prepare("DELETE FROM tokens WHERE height > :height").run({ height });
        database.prepare("DELETE FROM types WHERE height > :height").run({ height });

        database.prepare("DELETE FROM transactions WHERE block_height > :height").run({ height });
        database.prepare("DELETE FROM blocks WHERE height > :height").run({ height });
        database.prepare("DELETE FROM block_production_failures WHERE height > :height").run({ height });
        database.prepare("DELETE FROM rounds WHERE round > :round").run({ round });
        database.exec("COMMIT");
        database.pragma("foreign_keys = on");
    }
}

import { Commands, Container } from "@solar-network/core-cli";
import { Networks } from "@solar-network/crypto";
import envPaths from "env-paths";
import execa, { ExecaReturnValue } from "execa";
import { existsSync, mkdirSync, readFileSync, remove, statSync, writeFileSync } from "fs-extra";
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
    public signature: string = "database:create";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Create a new database to store the blockchain";

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
            .setFlag("reset", "Using the --reset flag will destroy and recreate existing database", Joi.boolean());
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const { data } = envPaths(this.getFlag("token"), { suffix: "core" });
        const databaseDir: string = `${data}/${this.getFlag("network")}/database`;
        const pidFile: string = databaseDir + "/postmaster.pid";
        if (existsSync(databaseDir)) {
            if (
                this.getFlag("reset") ||
                (await this.components.confirm(
                    `The ${this.getFlag(
                        "network",
                    )} database already exists. Do you want to destroy it and create a new one?`,
                ))
            ) {
                if (existsSync(pidFile) && statSync(pidFile).isFile()) {
                    try {
                        const pid: string = readFileSync(pidFile).toString().split("\n")[0];
                        process.kill(+pid);
                    } catch {
                        //
                    }
                }
                return this.createDatabase(databaseDir);
            }

            return;
        }

        return this.createDatabase(databaseDir);
    }

    private async shell(command: string): Promise<ExecaReturnValue> {
        return execa(command, { shell: true });
    }

    /**
     * @private
     * @returns {Promise<void>}
     * @memberof Command
     */
    private async createDatabase(databaseDir: string): Promise<void> {
        const spinner = this.components.spinner("Creating database");
        spinner.start();
        try {
            await remove(databaseDir);
            mkdirSync(databaseDir, { recursive: true });

            let shellResult = await this.shell(`${process.env.POSTGRES_DIR}/bin/initdb -D ${databaseDir}`);
            if (shellResult.exitCode !== 0) {
                throw new Error(shellResult.stderr.toString());
            }

            let config: string = readFileSync(`${databaseDir}/postgresql.conf`).toString();
            config +=
                `\n# ${this.getFlag("token")}\n` +
                `listen_addresses = ''\n` +
                `unix_socket_directories = '${databaseDir}'\n` +
                `unix_socket_permissions = 0700`;
            writeFileSync(`${databaseDir}/postgresql.conf`, config);

            shellResult = await this.shell(`${process.env.POSTGRES_DIR}/bin/pg_ctl -D ${databaseDir} start >/dev/null`);
            if (shellResult.exitCode !== 0) {
                throw new Error(shellResult.stderr.toString());
            }

            shellResult = await this.shell(
                `createdb -h ${databaseDir} ${this.getFlag("token")}_${this.getFlag("network")}`,
            );
            if (shellResult.exitCode !== 0) {
                throw new Error(shellResult.stderr.toString());
            }

            spinner.succeed();
        } catch (error) {
            spinner.fail();
            this.components.error(error);
        }
    }
}

import { Commands, Container, Services } from "@solar-network/core-cli";
import envPaths from "env-paths";
import { sync } from "execa";
import { existsSync, readdirSync, readFileSync, remove, statSync, writeFileSync } from "fs-extra";
import Joi from "joi";
import { homedir } from "os";
import { resolve } from "path";

/**
 * @export
 * @class Command
 * @extends {Commands.Command}
 */
@Container.injectable()
export class Command extends Commands.Command {
    @Container.inject(Container.Identifiers.ProcessManager)
    private readonly processManager!: Services.ProcessManager;

    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "uninstall";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Completely uninstalls the Core installation";

    /**
     * Indicates whether the command requires a network to be present.
     *
     * @type {boolean}
     * @memberof Command
     */
    public requiresNetwork: boolean = false;

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition.setFlag("force", "Force an uninstall", Joi.boolean());
        this.definition.setFlag("token", "The name of the token", Joi.string().default("solar"));
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        if (this.getFlag("force")) {
            return this.performUninstall();
        }

        if (await this.components.confirm("Are you sure you want to uninstall?")) {
            return this.performUninstall();
        }

        this.components.fatal("You'll need to confirm the uninstall to continue");
    }

    /**
     * @private
     * @returns {Promise<void>}
     * @memberof Command
     */
    private async performUninstall(): Promise<void> {
        const spinner = this.components.spinner("Uninstalling Core");
        spinner.start();

        try {
            if (this.processManager.has(`${this.getFlag("token")}-core`)) {
                await this.processManager.delete(`${this.getFlag("token")}-core`);
            }
            if (this.processManager.has(`${this.getFlag("token")}-relay`)) {
                await this.processManager.delete(`${this.getFlag("token")}-relay`);
            }
            if (this.processManager.has(`${this.getFlag("token")}-forger`)) {
                await this.processManager.delete(`${this.getFlag("token")}-forger`);
            }

            try {
                sync(`crontab -l | grep -v ".${this.getFlag("token")}/.env" | crontab -`, {
                    shell: true,
                });
            } catch {
                //
            }

            const home = homedir();
            const { cache, config, data, log, temp } = envPaths(this.getFlag("token"), { suffix: "core" });

            if (existsSync(data)) {
                readdirSync(data)
                    .map((dir) => `${data}/${dir}/database/postmaster.pid`)
                    .filter((file) => existsSync(file) && statSync(file).isFile())
                    .map((file) => readFileSync(file).toString().split("\n")[0])
                    .forEach((pid) => {
                        try {
                            process.kill(+pid, "SIGKILL");
                        } catch {
                            //
                        }
                    });
            }

            await remove(cache);
            await remove(config);
            await remove(data);
            await remove(log);
            await remove(temp);

            await remove(config.split("/").slice(0, -1).join("/") + "/@solar-network");

            await remove(`${home}/.${this.getFlag("token")}rc`);
            await remove(`${home}/.${this.getFlag("token")}`);

            const corePath = resolve(`${__dirname}/../../../../`);
            await remove(corePath);

            for (const file of [".bashrc", ".kshrc", ".zshrc"]) {
                const rcFile = `${home}/${file}`;
                if (existsSync(rcFile)) {
                    const data = readFileSync(rcFile).toString();
                    if (data.includes(`.${this.getFlag("token")}rc`)) {
                        writeFileSync(rcFile, data.replaceAll(`. "$HOME"/".${this.getFlag("token")}rc"`, ""));
                    }
                }
            }

            spinner.succeed();
        } catch (error) {
            spinner.fail();
            this.components.error(error);
        }
    }
}

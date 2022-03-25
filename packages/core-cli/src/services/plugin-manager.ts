import { existsSync, readdirSync, readJSONSync, removeSync, statSync } from "fs-extra";
import glob from "glob";
import { white } from "kleur";
import { join } from "path";

import { Spinner } from "../components";
import * as Contracts from "../contracts";
import { Identifiers, inject, injectable } from "../ioc";
import { Output } from "../output";
import { Environment } from "./environment";
import { Logger } from "./logger";
import { File, Git, NPM, Source } from "./source-providers";

@injectable()
export class PluginManager implements Contracts.PluginManager {
    @inject(Identifiers.Environment)
    private readonly environment!: Environment;

    @inject(Identifiers.Logger)
    private readonly logger!: Logger;

    @inject(Identifiers.Output)
    private readonly output!: Output;

    public async list(token: string, network: string): Promise<Contracts.Plugin[]> {
        const plugins: Contracts.Plugin[] = [];

        const path = this.getPluginsPath(token, network);

        const packagePaths = glob
            .sync("{@*/*/package.json,*/package.json}", { cwd: path })
            .map((packagePath) => join(path, packagePath).slice(0, -"/package.json".length));

        for (const packagePath of packagePaths) {
            try {
                const packageJson = readJSONSync(join(packagePath, "package.json"));

                plugins.push({
                    path: packagePath,
                    name: packageJson.name,
                    version: packageJson.version,
                });
            } catch {
                //
            }
        }

        return plugins;
    }

    public async install(token: string, network: string, pkg: string, version?: string): Promise<void> {
        for (const Instance of [File, Git, NPM]) {
            const source: Source = new Instance({
                data: this.getPluginsPath(token, network),
                temp: this.getTempPath(token, network),
            });

            if (await source.exists(pkg, version)) {
                const spinner = new Spinner().render(
                    `Installing ${pkg} from ${source.constructor.name.toLowerCase()}...`,
                );
                if (!this.output.isVerbose()) {
                    spinner.start();
                }
                try {
                    await source.install(pkg, version);
                } catch (error) {
                    if (!this.output.isVerbose()) {
                        spinner.fail();
                    }
                    throw error;
                }
                if (!this.output.isVerbose()) {
                    spinner.succeed();
                }
                return;
            }
        }

        throw new Error(`The given package [${pkg}] is neither a git nor a npm package`);
    }

    public async update(all: boolean, token: string, network: string, pkg: string): Promise<void> {
        if (!all && !pkg) {
            throw new Error("You must specify a package to update");
        }
        if (all && pkg) {
            throw new Error("You must not specify a package when using --all");
        }

        const paths = {
            data: this.getPluginsPath(token, network),
            temp: this.getTempPath(token, network),
        };
        if (all) {
            const directories = readdirSync(paths.data).filter((entity) =>
                statSync(`${paths.data}/${entity}`).isDirectory(),
            );
            const packages: string[] = [];
            for (const directory of directories) {
                if (directory.startsWith("@")) {
                    packages.push(
                        ...readdirSync(`${paths.data}/${directory}`)
                            .filter((entity) => statSync(`${paths.data}/${directory}/${entity}`).isDirectory())
                            .map((entity) => `${directory}/${entity}`),
                    );
                } else {
                    packages.push(directory);
                }
            }
            for (const name of packages) {
                try {
                    if (this.output.isVerbose()) {
                        this.logger.info(`Updating ${name}...`);
                    }
                    await this.update(false, token, network, name);
                } catch (error) {
                    this.logger.error(white().bgRed(`[ERROR] ${error.message}`));
                }
            }
            return;
        }
        const directory: string = join(paths.data, pkg);

        if (!existsSync(directory)) {
            throw new Error(`The package [${pkg}] does not exist`);
        }

        let spinner;

        if (existsSync(`${directory}/.git`)) {
            spinner = new Spinner().render(`Updating ${pkg} from git...`);
            if (!this.output.isVerbose()) {
                spinner.start();
            }
            try {
                await new Git(paths).update(pkg);
            } catch (error) {
                if (!this.output.isVerbose()) {
                    spinner.fail();
                }
                throw error;
            }
        } else {
            spinner = new Spinner().render(`Updating ${pkg} from npm...`);
            if (!this.output.isVerbose()) {
                spinner.start();
            }
            try {
                await new NPM(paths).update(pkg);
            } catch (error) {
                if (!this.output.isVerbose()) {
                    spinner.fail();
                }
                throw error;
            }
        }
        if (!this.output.isVerbose()) {
            spinner.succeed();
        }
    }

    public async remove(token: string, network: string, pkg: string): Promise<void> {
        const directory: string = join(this.getPluginsPath(token, network), pkg);

        if (!existsSync(directory)) {
            throw new Error(`The package [${pkg}] does not exist`);
        }

        const spinner = new Spinner().render(`Removing ${pkg}...`);
        spinner.start();
        try {
            removeSync(directory);
        } catch (error) {
            spinner.fail();
            throw error;
        }
        spinner.succeed();
    }

    private getPluginsPath(token: string, network: string): string {
        return join(this.environment.getPaths(token, network).data, "plugins");
    }

    private getTempPath(token: string, network: string): string {
        return join(this.environment.getPaths(token, network).temp, "plugins");
    }
}

import { Utils } from "@solar-network/kernel";
import execa from "execa";
import { ensureSymlinkSync } from "fs-extra";
import { join, resolve } from "path";

import { AbstractSource } from "./abstract-source";
/**
 * @export
 * @class Git
 * @implements {AbstractSource}
 */
export class Git extends AbstractSource {
    public constructor(paths: { data: string; temp: string }) {
        super(paths);
    }

    /**
     * @param {string} value
     * @returns {Promise<boolean>}
     * @memberof Git
     */
    /**
     * @param {string} value
     * @returns {Promise<boolean>}
     * @memberof Git
     */
    public async exists(value: string): Promise<boolean> {
        return Utils.isGit(value);
    }

    /**
     * @param {string} value
     * @returns {Promise<void>}
     * @memberof Git
     */
    public async update(value: string): Promise<void> {
        const dest = this.getDestPath(value);

        let subprocess = execa("git", ["reset", "--hard"], { cwd: dest });
        if (process.argv.includes("-v") || process.argv.includes("-vv")) {
            subprocess.stdout!.pipe(process.stdout);
            subprocess.stderr!.pipe(process.stderr);
        }
        await subprocess;

        subprocess = execa("git", ["pull"], { cwd: dest });
        if (process.argv.includes("-v") || process.argv.includes("-vv")) {
            subprocess.stdout!.pipe(process.stdout);
            subprocess.stderr!.pipe(process.stderr);
        }
        await subprocess;

        await this.installAndBuild(value);
    }

    protected async build(packageName: string): Promise<void> {
        const subprocess = execa("pnpm", ["build"], { cwd: this.getDestPath(packageName) });
        try {
            await subprocess;
        } catch {
            //
        }

        try {
            ensureSymlinkSync(this.getDestPath(packageName), super.getDestPath(packageName), "dir");
        } catch {
            //
        }
    }

    protected async preparePackage(value: string): Promise<void> {
        const subprocess = execa("git", ["clone", value, this.getOriginPath()]);
        if (process.argv.includes("-v") || process.argv.includes("-vv")) {
            subprocess.stdout!.pipe(process.stdout);
            subprocess.stderr!.pipe(process.stderr);
        }
        await subprocess;
    }

    protected getDestPath(packageName: string): string {
        const pluginPath = resolve(`${__dirname}/../../../../../plugins/`);
        return join(pluginPath, packageName.replaceAll("/", "-"));
    }
}

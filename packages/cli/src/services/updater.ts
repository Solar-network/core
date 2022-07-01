import { sync } from "execa";
import { dim, green, reset } from "kleur";
import * as semver from "semver";
import { PackageJson } from "type-fest";

import { Application } from "../application";
import { Confirm, Warning } from "../components";
import { Config } from "../contracts";
import * as Contracts from "../contracts";
import { Identifiers, inject, injectable } from "../ioc";
import { Installer } from "./installer";
import { ProcessManager } from "./process-manager";

/**
 * @export
 * @class Updater
 */
@injectable()
export class Updater implements Contracts.Updater {
    /**
     * @private
     * @type {Application}
     * @memberof Updater
     */
    @inject(Identifiers.Application)
    private readonly app!: Application;

    /**
     * @private
     * @type {Config}
     * @memberof Updater
     */
    @inject(Identifiers.Config)
    private readonly config!: Config;

    /**
     * @private
     * @type {PackageJson}
     * @memberof Updater
     */
    @inject(Identifiers.Package)
    private readonly pkg!: PackageJson;

    /**
     * @private
     * @type {Installer}
     * @memberof Updater
     */
    @inject(Identifiers.Installer)
    private readonly installer!: Installer;

    /**
     * @private
     * @type {ProcessManager}
     * @memberof Updater
     */
    @inject(Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    /**
     * @private
     * @type {(string | undefined)}
     * @memberof Updater
     */
    private latestVersion: string | undefined;

    private get packageName(): string {
        return this.pkg.name!;
    }

    private get packageVersion(): string {
        return this.pkg.version!;
    }

    private get packageChannel(): string {
        return this.config.get("channel");
    }

    /**
     * @returns {Promise<boolean>}
     * @memberof Updater
     */
    public async check(): Promise<boolean> {
        this.latestVersion = this.config.get("latestVersion");

        if (this.latestVersion) {
            this.config.forget("latestVersion");
        }

        const latestVersion: string | undefined = await this.getLatestVersion();

        if (latestVersion === undefined) {
            return false;
        }

        this.config.set("latestVersion", latestVersion);

        this.latestVersion = latestVersion;

        return true;
    }

    /**
     * @param {boolean} [updateProcessManager=false]
     * @param {boolean} [force=false]
     * @returns {Promise<boolean>}
     * @memberof Updater
     */
    public async update(updateProcessManager: boolean = false, force: boolean = false): Promise<boolean> {
        if (this.latestVersion === undefined) {
            return false;
        }

        if (!force) {
            const confirm = await this.app
                .get<Confirm>(Identifiers.Confirm)
                .render(
                    `Update available ${dim(this.packageVersion)} ${reset(" → ")} ${green(
                        this.latestVersion,
                    )}. Would you like to update?`,
                );

            if (!confirm) {
                throw new Error("You'll need to confirm the update to continue");
            }
        }

        await this.installer.install(this.packageName, this.packageChannel);

        if (updateProcessManager) {
            this.processManager.update();
        }

        return true;
    }

    /**
     * @private
     * @returns {(Promise<string | undefined>)}
     * @memberof Updater
     */
    public async getLatestVersion(): Promise<string | undefined> {
        const coreDirectory = __dirname + "/../../../../";

        let regex = '"^\\d+.\\d+.\\d+"';
        if (this.packageChannel === "next") {
            regex = '"^\\d+.\\d+.\\d+-next.\\d+"';
        }

        const command = `cd ${coreDirectory} && git tag -l | xargs git tag -d > /dev/null && git fetch --all --tags -fq && git tag --sort=committerdate | grep -Px ${regex} | tail -1`;
        const { stdout, exitCode } = sync(command, { shell: true });

        if (exitCode !== 0) {
            this.app
                .get<Warning>(Identifiers.Warning)
                .render(`Unable to find any releases for the "${this.packageChannel}" channel`);

            return undefined;
        }

        if (semver.lte(stdout, this.packageVersion)) {
            return undefined;
        }

        return stdout;
    }
}

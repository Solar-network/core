import execa from "execa";
import { ensureDirSync, moveSync, readJSONSync, removeSync } from "fs-extra";
import { join } from "path";

import { Source } from "./contracts";
import { InvalidPackageJson } from "./errors";

export abstract class AbstractSource implements Source {
    protected readonly dataPath: string;
    protected readonly tempPath: string;

    protected constructor({ data, temp }: { data: string; temp: string }) {
        this.dataPath = data;
        this.tempPath = temp;

        ensureDirSync(this.dataPath);
    }

    public async install(value: string, version?: string): Promise<void> {
        const origin = this.getOriginPath();

        removeSync(origin);

        await this.preparePackage(value, version);

        const packageName = this.getPackageName(origin);
        this.removeInstalledPackage(packageName);

        moveSync(origin, this.getDestPath(packageName));

        await this.installDependencies(packageName);

        removeSync(origin);
    }

    protected async installDependencies(packageName: string): Promise<void> {
        const subprocess = execa(`yarn`, ["install", "--production"], { cwd: this.getDestPath(packageName) });
        if (process.argv.includes("-v") || process.argv.includes("-vv")) {
            subprocess.stdout!.pipe(process.stdout);
            subprocess.stderr!.pipe(process.stderr);
        }
        await subprocess;
    }

    protected getOriginPath(): string {
        return join(this.tempPath, "package");
    }

    protected getDestPath(packageName: string): string {
        return join(this.dataPath, packageName);
    }

    protected getPackageName(path: string): string {
        try {
            return readJSONSync(join(path, "package.json")).name;
        } catch {
            throw new InvalidPackageJson();
        }
    }

    protected getPackageVersion(path: string): string {
        try {
            return readJSONSync(join(path, "package.json")).version;
        } catch {
            throw new InvalidPackageJson();
        }
    }

    protected removeInstalledPackage(packageName: string): void {
        removeSync(this.getDestPath(packageName));
    }

    public abstract exists(value: string, version?: string): Promise<boolean>;

    public abstract update(value: string): Promise<void>;

    protected abstract preparePackage(value: string, version?: string): Promise<void>;
}

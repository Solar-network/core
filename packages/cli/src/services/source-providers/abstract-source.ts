import execa from "execa";
import { ensureDirSync, moveSync, readJsonSync, removeSync } from "fs-extra";
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

        await this.installAndBuild(packageName);

        removeSync(origin);
    }

    protected async installAndBuild(packageName: string): Promise<void> {
        const subprocess = execa("pnpm", ["install"], { cwd: this.getDestPath(packageName) });
        if (process.argv.includes("-v") || process.argv.includes("-vv")) {
            subprocess.stdout!.pipe(process.stdout);
            subprocess.stderr!.pipe(process.stderr);
        }
        await subprocess;
        await this.build(packageName);
    }

    protected getOriginPath(): string {
        return join(this.tempPath, "package");
    }

    protected getDestPath(packageName: string): string {
        return join(this.dataPath, packageName);
    }

    protected getPackageName(path: string): string {
        try {
            return readJsonSync(join(path, "package.json")).name;
        } catch {
            throw new InvalidPackageJson();
        }
    }

    protected getPackageVersion(path: string): string {
        try {
            return readJsonSync(join(path, "package.json")).version;
        } catch {
            throw new InvalidPackageJson();
        }
    }

    protected removeInstalledPackage(packageName: string): void {
        const destPath: string = join(this.dataPath, packageName);
        const finalPath: string = this.getDestPath(packageName);
        removeSync(finalPath);
        if (destPath !== finalPath) {
            removeSync(destPath);
        }
    }

    public abstract exists(value: string, version?: string): Promise<boolean>;

    public abstract update(value: string): Promise<void>;

    protected abstract build(packageName: string): Promise<void>;

    protected abstract preparePackage(value: string, version?: string): Promise<void>;
}

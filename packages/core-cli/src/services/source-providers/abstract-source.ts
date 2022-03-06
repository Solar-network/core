import execa from "execa";
import {
    ensureDirSync,
    moveSync,
    readFileSync,
    readJSONSync,
    removeSync,
    statSync,
    writeFileSync,
    writeJSONSync,
} from "fs-extra";
import glob from "glob";
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

        this.translate(origin);

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

    protected removeInstalledPackage(packageName: string): void {
        removeSync(this.getDestPath(packageName));
    }

    public abstract exists(value: string, version?: string): Promise<boolean>;

    public abstract update(value: string): Promise<void>;

    protected abstract preparePackage(value: string, version?: string): Promise<void>;

    protected translate(origin: string): void {
        const files = glob
            .sync("**/*", { cwd: origin })
            .map((file) => `${origin}/${file}`)
            .filter((file) => statSync(file).isFile());

        for (const file of files) {
            if (file.endsWith("/package.json")) {
                const pkg = readJSONSync(file);
                if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
                    pkg.dependencies = Object.keys(pkg.dependencies).reduce((acc, key) => {
                        if (!key.startsWith("@arkecosystem/")) {
                            acc[key] = pkg.dependencies[key];
                        }
                        return acc;
                    }, {});
                }
                if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
                    pkg.devDependencies = Object.keys(pkg.devDependencies).reduce((acc, key) => {
                        if (!key.startsWith("@arkecosystem/")) {
                            acc[key] = pkg.devDependencies[key];
                        }
                        return acc;
                    }, {});
                }
                writeJSONSync(file, pkg, { spaces: 4 });
            }
            writeFileSync(file, readFileSync(file).toString().replaceAll("@arkecosystem/", "@solar-network/"));
        }
    }
}

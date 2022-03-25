import Listr from "@alessiodf/listr";
import delay from "delay";
import { sync } from "execa";
import { white } from "kleur";
import { spawn } from "node-pty";

import { Identifiers, inject, injectable } from "../ioc";
import { Output } from "../output";
import { Logger } from "./logger";

/**
 * @export
 * @class Installer
 */
@injectable()
export class Installer {
    @inject(Identifiers.Logger)
    private readonly logger!: Logger;

    @inject(Identifiers.Output)
    private readonly output!: Output;

    /**
     * @param {string} pkg
     * @memberof Installer
     */
    public async install(pkg: string, tag: string = "latest"): Promise<void> {
        const corePath = __dirname + "/../../../../";

        const getLastTag = (regex: string) => `git tag --sort=committerdate | grep -Px ${regex} | tail -1`;
        let gitTag: string = tag;
        let tagFromRegex!: string;

        let version: string = tag;

        const dependencies: Record<string, string> = {};
        const dependenciesListr = new Listr();

        const packages: Record<string, string> = {};
        const packagesListr = new Listr();

        if (tag === "latest") {
            tagFromRegex = getLastTag('"^\\d+.\\d+.\\d+"');
            gitTag = "`" + tagFromRegex + "`";
        } else if (tag === "next") {
            tagFromRegex = getLastTag('"^\\d+.\\d+.\\d+-next.\\d+"');
            gitTag = "`" + tagFromRegex + "`";
        }

        if (tagFromRegex) {
            version = sync(tagFromRegex, { cwd: corePath, shell: true }).stdout;
        }

        const generatePromise = (name?: string) => {
            let rejecter!: (value: void) => void;
            let resolver!: (value: void) => void;
            return {
                name,
                promise: new Promise<void>((resolve, reject) => {
                    (rejecter = reject), (resolver = resolve);
                }).catch(() => {}),
                reject: rejecter,
                resolve: resolver,
            };
        };

        const downloadPhase = generatePromise();
        const gitPhase = generatePromise();
        const installPhase = { start: generatePromise(), end: generatePromise() };

        const pnpmFlags = "--reporter=" + (this.output.isNormal() ? "ndjson" : "default");

        const shell = spawn(
            "/bin/bash",
            [
                "-c",
                `(git tag -l | xargs git tag -d &&
                git fetch --all --tags -f &&
                git reset --hard &&
                git checkout tags/${gitTag} &&
                CFLAGS="$CFLAGS" CPATH="$CPATH" LDFLAGS="$LDFLAGS" LD_LIBRARY_PATH="$LD_LIBRARY_PATH" pnpm install ${pnpmFlags} &&
                pnpm build ${pnpmFlags} &&
                exit 0) || exit $?`,
            ],
            { cols: process.stdout.columns, cwd: corePath, env: process.env as { [key: string]: string } },
        );

        let errorLevel = 0;
        let errorMessage!: string;
        let log: string = "";

        const shellExit = new Promise<void>((resolve, reject) => {
            shell.onExit(async ({ exitCode }) => {
                errorLevel = exitCode;
                if (exitCode === 0) {
                    resolve();
                } else {
                    const tasksInProgress = tasks.tasks.filter((task) => (task as any)._state === 0);
                    for (const task of tasksInProgress) {
                        (task as any)._state = 2;
                    }
                    await delay(250);
                    reject(`The process failed with error code ${exitCode}`);
                }
            });
        }).catch((error) => {
            let message: string;
            if (this.output.isNormal()) {
                message = `The process did not complete successfully:\n${log}\n${error}`;
            } else {
                message = error;
            }
            this.logger.error(white().bgRed(`[ERROR] ${message}`));
            process.exit(errorLevel);
        });

        let shellOutput = "";

        shell.onData((data: string) => {
            if (this.output.isNormal()) {
                shellOutput += data;
                while (shellOutput.includes("\n")) {
                    const line = shellOutput.substring(0, shellOutput.indexOf("\n"));
                    consume(line);
                    shellOutput = shellOutput.substring(line.length + 1);
                }
            } else {
                process.stdout.write(data);
            }
        });

        let workspacePrefix = "";

        function consume(data: string) {
            let line: string;
            let parsed: any = {};
            try {
                parsed = JSON.parse(data);
                line = parsed.line;
            } catch {
                line = data;
            }

            if (line && !line.startsWith("{") && !line.endsWith("}")) {
                log += line + "\n";
            }

            if (parsed.workspacePrefix) {
                workspacePrefix = parsed.workspacePrefix;
                gitPhase.resolve();
            }

            if (parsed.initial && parsed.initial.name && parsed.prefix) {
                const prefix = parsed.prefix.replace(workspacePrefix, "");
                if (prefix) {
                    packages[parsed.prefix] = parsed.initial.name;
                    packagesListr.add([
                        {
                            title: `Building ${parsed.initial.name}`,
                            task: () => shellExit,
                        },
                    ]);
                }
            }

            if (parsed.name === "pnpm:summary") {
                downloadPhase.resolve();
                installPhase.start.resolve();
                installPhase.end.resolve();
            }

            if (parsed.script !== undefined) {
                const pkg = packages[parsed.depPath];
                if (pkg) {
                    (packagesListr.tasks.find((task) => task.title === `Building ${pkg}`)! as any)._state = 0;
                } else if (parsed.depPath) {
                    const depPath: string[] = parsed.depPath.split("/");
                    let dependency: string = depPath[depPath.length - 1];
                    if (/^\d+.\d+.\d+$|^\d+.\d+.\d+-next.\d+$/.test(dependency)) {
                        dependency = depPath[depPath.length - 2];
                    }
                    if (!dependencies[parsed.depPath]) {
                        dependenciesListr.add([
                            {
                                title: `Building ${dependency}`,
                                task: () => installPhase.end.promise,
                            },
                        ]);
                        (
                            dependenciesListr.tasks.find((task) => task.title === `Building ${dependency}`)! as any
                        )._state = 0;
                        dependencies[parsed.depPath] = dependency;
                    }
                    downloadPhase.resolve();
                    installPhase.start.resolve();
                }
            }

            if (parsed.exitCode !== undefined) {
                let listr!: Listr;
                let pkg!: string;
                if (packages[parsed.depPath]) {
                    listr = packagesListr;
                    pkg = packages[parsed.depPath];
                } else if (dependencies[parsed.depPath]) {
                    listr = dependenciesListr;
                    pkg = dependencies[parsed.depPath];
                }

                if (listr && pkg) {
                    (listr.tasks.find((task) => task.title === `Building ${pkg}`)! as any)._state =
                        parsed.exitCode === 0 ? 1 : 2;
                    if (parsed.exitCode !== 0) {
                        const tasksInProgress = listr.tasks.filter((task) => (task as any)._state === 0);
                        for (const task of tasksInProgress) {
                            delete (task as any)._state;
                        }
                    }
                }
            }
        }

        const tasks = new Listr([
            {
                title: `Downloading Core ${version}`,
                task: () => gitPhase.promise,
            },
            {
                title: "Downloading dependencies",
                task: () => downloadPhase.promise,
            },
            {
                title: "Building dependencies",
                task: async () => {
                    await installPhase.start.promise;
                    return dependenciesListr;
                },
            },
            {
                title: `Building Core ${version}`,
                task: () => packagesListr,
            },
        ]);

        if (this.output.isNormal()) {
            await tasks.run(tasks);
        } else {
            await shellExit;
        }

        if (errorMessage) {
            throw new Error(errorMessage);
        }
    }
}

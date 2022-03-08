import { sync } from "execa";
import Listr, { ListrTaskWrapper } from "listr";
import { spawn } from "node-pty";

import { Application } from "../application";
import { Spinner, TaskList } from "../components";
import { Identifiers, inject, injectable } from "../ioc";
import { Output } from "../output";

/**
 * @export
 * @class Installer
 */
@injectable()
export class Installer {
    @inject(Identifiers.Application)
    private readonly app!: Application;

    @inject(Identifiers.Output)
    private readonly output!: Output;

    /**
     * @param {string} pkg
     * @memberof Installer
     */
    public async install(pkg: string, tag: string = "latest"): Promise<void> {
        const coreDirectory = __dirname + "/../../../../";

        const getLastTag = (regex) => `git tag --sort=committerdate | grep -Px ${regex} | tail -1`;
        let gitTag: string = tag;
        let tagFromRegex!: string;

        let version: string = tag;

        if (tag === "latest") {
            tagFromRegex = getLastTag('"^\\d+.\\d+.\\d+"');
            gitTag = "`" + tagFromRegex + "`";
        } else if (tag === "next") {
            tagFromRegex = getLastTag('"^\\d+.\\d+.\\d+-next.\\d+"');
            gitTag = "`" + tagFromRegex + "`";
        }

        if (tagFromRegex) {
            version = sync(tagFromRegex, { cwd: coreDirectory, shell: true }).stdout;
        }

        let currentTask: ListrTaskWrapper;
        let errorMessage!: string;
        let log = "";
        const packages = { building: 0, total: 0 };
        let phase = 0;
        const phaseComplete: {
            promise: Promise<void>;
            reject: (value: void) => void;
            resolve: (value: void) => void;
        }[] = [];

        const nextPhase = () => {
            phaseComplete[phase].resolve();
            phase++;
        };

        for (let i = 0; i < 5; i++) {
            let rejecter!: (value: void) => void;
            let resolver!: (value: void) => void;
            phaseComplete.push({
                promise: new Promise<void>((resolve, reject) => {
                    (rejecter = reject), (resolver = resolve);
                }).catch(() => {}),
                reject: rejecter,
                resolve: resolver,
            });
        }

        const shell = spawn(
            "sh",
            [
                "-c",
                `( git tag -l | xargs git tag -d && git fetch --all --tags -f && rm -f node_modules/better-sqlite3/build/Release/better_sqlite3.node && git reset --hard && git checkout tags/${gitTag} && yarn --force && yarn lerna:verbose run build && cd node_modules/better-sqlite3 && npm rebuild && exit 0 ) || exit $?`,
            ],
            { cwd: coreDirectory },
        );
        const shellExit = new Promise<void>((resolve, reject) => {
            shell.onExit(({ exitCode }) => {
                if (exitCode === 0) {
                    if (phase === 4) {
                        nextPhase();
                    }
                    resolve();
                } else {
                    reject(`Process failed with error code ${exitCode}`);
                }
            });
        }).catch((error) => {
            if (this.output.isNormal()) {
                errorMessage = `The process did not complete successfully:\n${log}\n${error}`;
            } else {
                errorMessage = error;
            }
            for (const phase of phaseComplete) {
                phase.reject();
            }
        });

        shell.onData((data) => {
            if (this.output.isNormal()) {
                log += data;
                const output = data
                    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
                    .trim()
                    .split("\n");
                for (const line of output) {
                    switch (phase) {
                        case 0: {
                            if (line.includes("yarn install")) {
                                nextPhase();
                            }
                            break;
                        }
                        case 1: {
                            if (line.includes("]")) {
                                const progress = line
                                    .substring(line.indexOf("]") + 1)
                                    .trim()
                                    .split("/");
                                if (!isNaN(+progress[0]) && !isNaN(+progress[1])) {
                                    currentTask.title = `Fetching dependencies (${progress[0]} of ${progress[1]})`;
                                }
                            }
                            if (line.includes("Linking dependencies...")) {
                                currentTask.title = "Fetching dependencies";
                                nextPhase();
                            }
                            break;
                        }
                        case 2: {
                            if (line.includes("]")) {
                                const progress = line
                                    .substring(line.indexOf("]") + 1)
                                    .trim()
                                    .split("/");
                                if (!isNaN(+progress[0]) && !isNaN(+progress[1])) {
                                    currentTask.title = `Linking dependencies (${progress[0]} of ${progress[1]})`;
                                }
                            }
                            if (
                                line.includes("Rebuilding all packages...") ||
                                line.includes("Building fresh packages...")
                            ) {
                                currentTask.title = "Linking dependencies";
                                nextPhase();
                            }
                            break;
                        }
                        case 3: {
                            if (line.includes("]")) {
                                const dependencyName = line.substring(line.lastIndexOf(" ") + 1);
                                const progress = line.substring(1, line.indexOf("]")).trim().split("/");
                                if (!isNaN(+progress[0]) && !isNaN(+progress[1])) {
                                    currentTask.title = `Building dependencies (${progress[0]} of ${progress[1]}: ${dependencyName})`;
                                }
                            }
                            if (line.includes("Done in")) {
                                currentTask.title = "Building dependencies";
                                nextPhase();
                            }
                            break;
                        }
                        case 4: {
                            if (line.includes("Executing command in")) {
                                packages.total = +line
                                    .substring(line.indexOf("Executing command in") + 21)
                                    .split(" ")[0];
                            }
                            if (line.includes("build []")) {
                                const packageName = line.substring(line.lastIndexOf(" ") + 1).trim();
                                packages.building++;
                                currentTask.title = `Installing Core packages (${packages.building} of ${packages.total}: ${packageName})`;
                            }
                        }
                    }
                }
            } else {
                process.stdout.write(data);
            }
        });
        const tasks = [
            {
                title: `Downloading Core ${version}`,
                task: async (ctx, task) => {
                    currentTask = task;
                    await phaseComplete[0].promise;
                },
            },
            {
                title: `Preparing to build Core ${version}`,
                task: () => {
                    return new Listr([
                        {
                            title: "Fetching dependencies",
                            task: async (ctx, task) => {
                                currentTask = task;
                                await phaseComplete[1].promise;
                            },
                        },
                        {
                            title: "Linking dependencies",
                            task: async (ctx, task) => {
                                currentTask = task;
                                await phaseComplete[2].promise;
                            },
                        },
                        {
                            title: "Building dependencies",
                            task: async (ctx, task) => {
                                currentTask = task;
                                await phaseComplete[3].promise;
                            },
                        },
                    ]);
                },
            },
            {
                title: `Building Core ${version}`,
                task: async () => {
                    return new Listr([
                        {
                            title: `Installing Core packages`,
                            task: async (ctx, task) => {
                                currentTask = task;
                                await phaseComplete[4].promise;
                                task.title = "Installing Core packages";
                            },
                        },
                    ]);
                },
            },
        ];

        this.app.get<Spinner>(Identifiers.Spinner).get().stop();

        if (this.output.isNormal()) {
            await this.app.get<TaskList>(Identifiers.TaskList).render(tasks);
        }

        await shellExit;

        if (errorMessage) {
            throw new Error(errorMessage);
        }
    }
}

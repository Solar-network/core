import { createColors } from "colorette";
import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { Tail } from "tail";

import { injectable } from "../ioc";

const { bold, gray, magenta, red } = createColors({ useColor: true });

@injectable()
export class LogProcess {
    /**
     * @param {string[]} processes
     * @param {number} lines
     * @returns {Promise<void>}
     * @memberof Log
     */
    public async execute(processes: string[], lines: number): Promise<void> {
        const logPath: string = `${homedir()}/.pm2/logs`;
        if (!existsSync(logPath) || !statSync(logPath).isDirectory()) {
            throw new Error(`The ${logPath} directory is not valid`);
        }

        const tails: Record<string, Tail>[] = [];

        for (const proc of processes) {
            const errFile = `${logPath}/${proc}-error.log`;
            const outFile = `${logPath}/${proc}-out.log`;
            if (existsSync(errFile) && statSync(errFile).isFile()) {
                const lastLines = this.readLastLines(proc, errFile, lines);
                if (lastLines) {
                    console.error(
                        gray(
                            `Showing the last ${lines} lines of the ${bold(
                                proc,
                            )} error log (change the number of lines with the --lines option):`,
                        ),
                    );
                    console.error();
                    console.error(red(lastLines));
                    console.error();
                }

                tails.push({ process: proc, tail: new Tail(errFile) });
            }

            if (existsSync(outFile) && statSync(outFile).isFile()) {
                const lastLines = this.readLastLines(proc, outFile, lines);
                if (lastLines) {
                    console.log(
                        gray(
                            `Showing the last ${lines} lines of the ${bold(
                                proc,
                            )} output log (change the number of lines with the --lines option):`,
                        ),
                    );
                    console.log();
                    console.log(lastLines);
                    console.log();
                }

                tails.push({ process: proc, tail: new Tail(outFile) });
            }
        }

        if (tails.length > 0) {
            console.log(gray("New log entries will appear below:"));
            console.log();

            for (const { process, tail } of tails) {
                tail.on("line", (line: string) => {
                    console.error(this.addProcessName(process, line));
                });
                tail.watch();
            }
        } else {
            throw new Error("No log files were found");
        }
    }

    private addProcessName(process: string, line: string): string {
        return `${magenta(process.padEnd(9))}${line}`;
    }

    private readLastLines(process: string, file: string, lines: number): string {
        try {
            return readFileSync(file)
                .toString()
                .split("\n")
                .slice(lines * -1 - 1)
                .filter((line) => line.length > 0)
                .map((line) => this.addProcessName(process, line))
                .join("\n")
                .trim();
        } catch {
            return "";
        }
    }
}

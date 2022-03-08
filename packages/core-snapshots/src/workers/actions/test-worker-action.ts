import { Container } from "@solar-network/core-kernel";
import { parentPort } from "worker_threads";

import { Worker } from "../../contracts";

// For testing purposes only
@Container.injectable()
export class TestWorkerAction implements Worker.WorkerAction {
    private options!: { table: string };
    private resume: Function | undefined;

    public init(options: { table: string }): void {
        this.options = options;
    }

    public sync(data: { execute: string }): void {
        /* istanbul ignore next */
        if (this.resume) {
            this.resume();
        }

        if (data.execute === "throwError") {
            throw new Error("Sync Error");
        }
    }

    public async start(): Promise<void> {
        if (this.options.table === "throwError") {
            throw new Error("Start Error");
        }

        if (this.options.table === "wait") {
            parentPort!.postMessage({
                action: "started",
            });

            await new Promise<void>((resolve) => {
                this.resume = () => {
                    resolve();
                };
            });
            await new Promise<void>((resolve) => {
                this.resume = () => {
                    resolve();
                };
            });
        }
    }
}

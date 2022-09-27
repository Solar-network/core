import ora from "@alessiodf/ora";
import { Container, Contracts } from "@solar-network/kernel";
import { magenta } from "colorette";

import { SnapshotApplicationEvents } from "./events";

export class ProgressRenderer {
    public spinner: ora;

    private isAnyStarted: boolean = false;

    private count = {
        blocks: 0,
        missedBlocks: 0,
        transactions: 0,
        rounds: 0,
    };

    private progress = {
        blocks: "---.--",
        missedBlocks: "---.--",
        transactions: "---.--",
        rounds: "---.--",
    };

    public constructor(app: Contracts.Kernel.Application) {
        this.spinner = ora();

        const events = app.get<Contracts.Kernel.EventDispatcher>(Container.Identifiers.EventDispatcherService);

        events.listen(SnapshotApplicationEvents.SnapshotStart, {
            handle: (data) => {
                this.handleStart(data.data);
            },
        });

        events.listen(SnapshotApplicationEvents.SnapshotProgress, {
            handle: (data) => {
                this.handleUpdate(data.data);
            },
        });

        events.listen(SnapshotApplicationEvents.SnapshotComplete, {
            handle: (data) => {
                this.handleComplete(data.data);
            },
        });
    }

    private handleStart(data: { table: string; count: number }): void {
        if (data.table && data.count) {
            this.count[data.table] = data.count;

            if (!this.isAnyStarted) {
                this.isAnyStarted = true;
                this.spinner.start();
                this.render();
            }
        }
    }

    private handleUpdate(data: { table: string; value: number }): void {
        if (data.table && data.value) {
            this.progress[data.table] = this.calculatePercentage(this.count[data.table], data.value);

            this.render();
        }
    }

    private handleComplete(data: { table: string }): void {
        if (data.table) {
            this.progress[data.table] = "100.00";
        }
        this.render();
    }

    private calculatePercentage(count: number, value: number): string {
        const percent: string = ((value / count) * 100).toFixed(2);
        try {
            return `${" ".repeat(6 - percent.length)}${percent}`;
        } catch {
            return "";
        }
    }

    private render(): void {
        this.spinner.text = magenta(
            ` Blocks: ${this.progress.blocks} % Transactions: ${this.progress.transactions} % Rounds: ${this.progress.rounds} %`,
        );
    }
}

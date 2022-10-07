import { Utils } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import { cpus } from "os";

@Container.injectable()
export class QueryRunner implements Contracts.Database.QueryRunner {
    @Container.inject(Container.Identifiers.LogService)
    public readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.DatabaseWorkerFactory)
    private readonly createWorker!: Contracts.Database.WorkerFactory;

    private workers: Contracts.Database.Worker[] = [];

    @Container.postConstruct()
    public initialise(): void {
        const workerCount: number = cpus().length;
        for (let i = 0; i < workerCount; i++) {
            const worker: Contracts.Database.Worker = this.createWorker();
            worker.start();
            this.workers.push(worker);
        }
    }

    public checkpoint(): void {
        const worker: Contracts.Database.Worker = this.getWorker();
        return worker.checkpoint();
    }

    public async pragma(pragma: string): Promise<any> {
        const worker: Contracts.Database.Worker = this.getWorker();
        return worker.pragma(pragma);
    }

    public async maintenance(): Promise<void> {
        const actions: Set<string> = new Set();
        for (const worker of this.workers) {
            const pragma: string[] = (await worker.pragma("optimize(-1)"))?.split("\n") ?? [];
            for (const line of pragma) {
                actions.add(line);
            }
        }
        if (actions.size > 0) {
            this.logger.info("Optimising database before shutting down", "⚙️");
            for (const action of actions) {
                await this.getWorker().query(action);
            }
        }
    }

    public async query(sql: string, parameters?: Record<string, any>[]): Promise<any[]> {
        const worker: Contracts.Database.Worker = this.getWorker();
        const result = await worker.query(sql, parameters);
        if (Array.isArray(result)) {
            for (const row of result) {
                for (const [key, value] of Object.entries(row)) {
                    if (typeof value === "bigint") {
                        row[key] = Utils.BigNumber.make(value);
                    }
                }
            }
        }

        return result;
    }

    public async transaction(
        queries: Contracts.Database.DatabaseTransaction[],
        enforceForeignKeys: boolean = true,
    ): Promise<void> {
        const worker: Contracts.Database.Worker = this.getWorker();
        return worker.transaction(queries, enforceForeignKeys);
    }

    private getWorker(): Contracts.Database.Worker {
        return this.workers.reduce((prev, next) => {
            if (prev.getQueueSize() < next.getQueueSize()) {
                return prev;
            } else {
                return next;
            }
        });
    }
}

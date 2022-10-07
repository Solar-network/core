import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class Worker implements Contracts.Database.Worker {
    @Container.inject(Container.Identifiers.DatabaseWorkerThreadFactory)
    private readonly createWorkerThread!: Contracts.Database.WorkerThreadFactory;

    private workerThread!: Contracts.Database.WorkerThread;

    @Container.postConstruct()
    public initialise(): void {
        this.workerThread = this.createWorkerThread();
    }

    public getQueueSize(): number {
        return this.workerThread.getQueueSize();
    }

    public async pragma(pragma: string): Promise<void> {
        return await this.workerThread.sendRequest("pragma", pragma);
    }

    public async query(sql: string, parameters?: Record<string, any>[]): Promise<any[]> {
        return await this.workerThread.sendRequest("query", sql, parameters);
    }

    public async transaction(
        queries: Contracts.Database.DatabaseTransaction[],
        enforceForeignKeys: boolean = true,
    ): Promise<void> {
        return await this.workerThread.sendRequest("transaction", queries, enforceForeignKeys);
    }

    public start(): void {
        this.workerThread.sendAction("start");
    }

    public checkpoint(): void {
        this.workerThread.sendAction("checkpoint");
    }
}

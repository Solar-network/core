import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Providers } from "@solar-network/kernel";

@Container.injectable()
export class WorkerPool implements Contracts.Pool.WorkerPool {
    @Container.inject(Container.Identifiers.PoolWorkerFactory)
    private readonly createWorker!: Contracts.Pool.WorkerFactory;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly pluginConfiguration!: Providers.PluginConfiguration;

    private workers: Contracts.Pool.Worker[] = [];

    @Container.postConstruct()
    public initialise(): void {
        const workerCount: number = this.pluginConfiguration.getRequired("workerPool.workerCount");
        for (let i = 0; i < workerCount; i++) {
            this.workers.push(this.createWorker());
        }
    }

    public async getTransaction(
        transactionData: Interfaces.ITransactionData | Buffer,
    ): Promise<Interfaces.ITransaction> {
        const worker: Contracts.Pool.Worker = this.workers.reduce((prev, next) => {
            if (prev.getQueueSize() < next.getQueueSize()) {
                return prev;
            } else {
                return next;
            }
        });

        return worker.getTransaction(transactionData);
    }
}

import { Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class Worker implements Contracts.Pool.Worker {
    @Container.inject(Container.Identifiers.PoolWorkerThreadFactory)
    private readonly createWorkerThread!: Contracts.Pool.WorkerThreadFactory;

    private workerThread!: Contracts.Pool.WorkerThread;
    private lastHeight = 0;

    @Container.postConstruct()
    public initialise(): void {
        this.workerThread = this.createWorkerThread();
    }

    public getQueueSize(): number {
        return this.workerThread.getQueueSize();
    }

    public async getTransaction(
        transactionData: Interfaces.ITransactionData | Buffer,
    ): Promise<Interfaces.ITransaction> {
        const currentHeight = Managers.configManager.getHeight()!;
        if (currentHeight !== this.lastHeight) {
            this.lastHeight = currentHeight;
            this.workerThread.sendAction("setConfig", Managers.configManager.all());
            this.workerThread.sendAction("setHeight", currentHeight);
        }

        const { addresses, id, serialised, isVerified } = await this.workerThread.sendRequest(
            "getTransaction",
            transactionData instanceof Buffer ? transactionData.toString("hex") : transactionData,
        );

        const transaction = Transactions.TransactionFactory.fromBytesUnsafe(
            Buffer.from(serialised, "hex"),
            id,
            addresses,
        );
        transaction.isVerified = isVerified;
        return transaction;
    }
}

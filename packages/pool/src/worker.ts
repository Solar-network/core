import { Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class Worker implements Contracts.Pool.Worker {
    @Container.inject(Container.Identifiers.PoolWorkerIpcSubprocessFactory)
    private readonly createWorkerSubprocess!: Contracts.Pool.WorkerIpcSubprocessFactory;

    private ipcSubprocess!: Contracts.Pool.WorkerIpcSubprocess;
    private lastHeight = 0;

    @Container.postConstruct()
    public initialise(): void {
        this.ipcSubprocess = this.createWorkerSubprocess();
    }

    public getQueueSize(): number {
        return this.ipcSubprocess.getQueueSize();
    }

    public async getTransaction(
        transactionData: Interfaces.ITransactionData | Buffer,
    ): Promise<Interfaces.ITransaction> {
        const currentHeight = Managers.configManager.getHeight()!;
        if (currentHeight !== this.lastHeight) {
            this.lastHeight = currentHeight;
            this.ipcSubprocess.sendAction("setConfig", Managers.configManager.all());
            this.ipcSubprocess.sendAction("setHeight", currentHeight);
        }

        const { addresses, id, serialised, isVerified } = await this.ipcSubprocess.sendRequest(
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

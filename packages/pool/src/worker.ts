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

    public loadCryptoPackage(packageName: string): void {
        this.ipcSubprocess.sendAction("loadCryptoPackage", packageName);
    }

    public async getTransactionFromData(
        transactionData: Interfaces.ITransactionData | Buffer,
    ): Promise<Interfaces.ITransaction> {
        const currentHeight = Managers.configManager.getHeight()!;
        if (currentHeight !== this.lastHeight) {
            this.lastHeight = currentHeight;
            this.ipcSubprocess.sendAction("setConfig", Managers.configManager.all());
            this.ipcSubprocess.sendAction("setHeight", currentHeight);
        }

        const { id, serialised, isVerified } = await this.ipcSubprocess.sendRequest(
            "getTransactionFromData",
            transactionData instanceof Buffer ? transactionData.toString("hex") : transactionData,
        );
        const transaction = Transactions.TransactionFactory.fromBytesUnsafe(Buffer.from(serialised, "hex"), id);
        transaction.isVerified = isVerified;

        return transaction;
    }
}

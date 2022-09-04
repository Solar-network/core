import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

@Container.injectable()
export class Mempool implements Contracts.Pool.Mempool {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PoolSenderMempoolFactory)
    private readonly createSenderMempool!: Contracts.Pool.SenderMempoolFactory;

    private readonly senderMempools = new Map<string, Contracts.Pool.SenderMempool>();

    public getSize(): number {
        return Array.from(this.senderMempools.values()).reduce((sum, p) => sum + p.getSize(), 0);
    }

    public hasSenderMempool(senderId: string): boolean {
        return this.senderMempools.has(senderId);
    }

    public getSenderMempool(senderId: string): Contracts.Pool.SenderMempool {
        const senderMempool = this.senderMempools.get(senderId);
        if (!senderMempool) {
            throw new Error("Unknown sender");
        }
        return senderMempool;
    }

    public getSenderMempools(): Iterable<Contracts.Pool.SenderMempool> {
        return this.senderMempools.values();
    }

    public async addTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        let senderMempool = this.senderMempools.get(transaction.data.senderId);
        if (!senderMempool) {
            senderMempool = this.createSenderMempool();
            this.senderMempools.set(transaction.data.senderId, senderMempool);
            this.logger.debug(`${transaction.data.senderId} state created`);
        }

        try {
            await senderMempool.addTransaction(transaction);
        } finally {
            if (senderMempool.isDisposable()) {
                this.senderMempools.delete(transaction.data.senderId);
                this.logger.debug(`${transaction.data.senderId} state disposed`);
            }
        }
    }

    public async removeTransaction(senderId: string, id: string): Promise<Interfaces.ITransaction[]> {
        const senderMempool = this.senderMempools.get(senderId);
        if (!senderMempool) {
            return [];
        }

        try {
            return await senderMempool.removeTransaction(id);
        } finally {
            if (senderMempool.isDisposable()) {
                this.senderMempools.delete(senderId);
                this.logger.debug(`${senderId} state disposed`);
            }
        }
    }

    public async removeForgedTransaction(senderId: string, id: string): Promise<Interfaces.ITransaction[]> {
        const senderMempool = this.senderMempools.get(senderId);
        if (!senderMempool) {
            return [];
        }

        try {
            return await senderMempool.removeForgedTransaction(id);
        } finally {
            if (senderMempool.isDisposable()) {
                this.senderMempools.delete(senderId);
                this.logger.debug(`${senderId} state disposed`);
            }
        }
    }

    public flush(): void {
        this.senderMempools.clear();
    }
}

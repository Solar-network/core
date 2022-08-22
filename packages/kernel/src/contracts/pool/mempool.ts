import { Interfaces } from "@solar-network/crypto";

import { SenderMempool } from "./sender-mempool";

export interface Mempool {
    getSize(): number;

    hasSenderMempool(senderId: string): boolean;
    getSenderMempool(senderId: string): SenderMempool;
    getSenderMempools(): Iterable<SenderMempool>;

    addTransaction(transaction: Interfaces.ITransaction): Promise<void>;
    removeTransaction(senderId: string, id: string): Promise<Interfaces.ITransaction[]>;
    removeForgedTransaction(senderId: string, id: string): Promise<Interfaces.ITransaction[]>;

    flush(): void;
}

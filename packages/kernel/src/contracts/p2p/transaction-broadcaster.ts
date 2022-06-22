import { Interfaces } from "@solar-network/crypto";

export interface TransactionBroadcaster {
    broadcastTransactions(transactions: Interfaces.ITransaction[]): Promise<void>;
}

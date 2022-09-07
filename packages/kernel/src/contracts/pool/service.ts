import { Interfaces } from "@solar-network/crypto";

import { Wallet } from "../state";

export interface Service {
    getPoolSize(): number;

    addTransaction(transaction: Interfaces.ITransaction): Promise<void>;
    getPoolWallet(address: string): Wallet | undefined;
    readdTransactions(previouslyForgedTransactions?: Interfaces.ITransaction[]): Promise<void>;
    removeTransaction(transaction: Interfaces.ITransaction): Promise<void>;
    removeForgedTransaction(transaction: Interfaces.ITransaction): Promise<void>;
    cleanUp(): Promise<void>;
    flush(): Promise<void>;
}

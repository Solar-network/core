import { Interfaces } from "@solar-network/crypto";

import { WorkerThread as AppUtilsWorkerThread } from "../../utils/worker-thread";

export type SerialisedTransaction = {
    addresses: Interfaces.IDeserialiseAddresses;
    id: string;
    serialised: string;
    isVerified: boolean;
};

export interface WorkerScriptHandler {
    setConfig(networkConfig: any): void;
    setHeight(height: number): void;
    getTransaction(transactionData: Interfaces.ITransactionData | string): Promise<void>;
}

export type WorkerThread = AppUtilsWorkerThread<WorkerScriptHandler>;

export type WorkerThreadFactory = () => WorkerThread;

export interface Worker {
    getQueueSize(): number;
    getTransaction(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

export type WorkerFactory = () => Worker;

export interface WorkerPool {
    getTransaction(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

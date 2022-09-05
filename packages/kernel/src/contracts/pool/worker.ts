import { Interfaces } from "@solar-network/crypto";

import { IpcSubprocess } from "../../utils/ipc-subprocess";

export type SerialisedTransaction = {
    addresses: Interfaces.IDeserialiseAddresses;
    id: string;
    serialised: string;
    isVerified: boolean;
};

export interface WorkerScriptHandler {
    setConfig(networkConfig: any): void;
    setHeight(height: number): void;
    getTransaction(transactionData: Interfaces.ITransactionData | string): Promise<SerialisedTransaction>;
}

export type WorkerIpcSubprocess = IpcSubprocess<WorkerScriptHandler>;

export type WorkerIpcSubprocessFactory = () => WorkerIpcSubprocess;

export interface Worker {
    getQueueSize(): number;
    getTransaction(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

export type WorkerFactory = () => Worker;

export interface WorkerPool {
    getTransaction(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

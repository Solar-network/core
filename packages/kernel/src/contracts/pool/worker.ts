import { Enums, Interfaces } from "@solar-network/crypto";

import { IpcSubprocess } from "../../utils/ipc-subprocess";

export type SerialisedTransaction = {
    id: string;
    serialised: string;
    isVerified: boolean;
};

export interface WorkerScriptHandler {
    loadCryptoPackage(packageName: string): void;
    setConfig(networkConfig: any): void;
    setHeight(height: number): void;
    getTransactionFromData(transactionData: Interfaces.ITransactionData | string): Promise<SerialisedTransaction>;
}

export type WorkerIpcSubprocess = IpcSubprocess<WorkerScriptHandler>;

export type WorkerIpcSubprocessFactory = () => WorkerIpcSubprocess;

export interface Worker {
    getQueueSize(): number;
    loadCryptoPackage(packageName: string): void;
    getTransactionFromData(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

export type WorkerFactory = () => Worker;

export interface WorkerPool {
    isTypeGroupSupported(typeGroup: Enums.TransactionTypeGroup): boolean;
    getTransactionFromData(transactionData: Interfaces.ITransactionData | Buffer): Promise<Interfaces.ITransaction>;
}

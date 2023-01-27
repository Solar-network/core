import { Interfaces } from "@solar-network/crypto";

import { Wallet } from "../state";

export interface SenderMempool {
    isDisposable(): boolean;
    getSize(): number;

    getFromEarliest(): Iterable<Interfaces.ITransaction>;
    getFromLatest(): Iterable<Interfaces.ITransaction>;

    addTransaction(transaction: Interfaces.ITransaction): Promise<void>;
    removeTransaction(id: string): Promise<Interfaces.ITransaction[]>;
    removeConfirmedTransaction(id: string): Promise<Interfaces.ITransaction[]>;

    setAddress(address: string): void;
    getWallet(): Wallet | undefined;
}

export type SenderMempoolFactory = () => SenderMempool;

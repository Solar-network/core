export type StoredTransaction = {
    height: number;
    id: string;
    senderId: string;
    serialised: Buffer;
};

export interface Storage {
    addTransaction(storedTransaction: StoredTransaction): void;
    hasTransaction(id: string): boolean;
    getAllTransactions(): Iterable<StoredTransaction>;
    getOldTransactions(height: number): Iterable<StoredTransaction>;
    removeTransaction(id: string): void;
    flush(): void;
}

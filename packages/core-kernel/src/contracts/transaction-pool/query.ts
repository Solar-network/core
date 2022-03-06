import { Enums, Interfaces } from "@solar-network/crypto";

export type QueryPredicate = (transaction: Interfaces.ITransaction) => boolean;

export interface Query {
    getAll(): QueryIterable;
    getAllBySender(senderPublicKey: string): QueryIterable;
    getFromLowestPriority(): QueryIterable;
    getFromHighestPriority(): QueryIterable;
}

export interface QueryIterable extends Iterable<Interfaces.ITransaction> {
    wherePredicate(predicate: QueryPredicate): QueryIterable;
    whereId(id: string): QueryIterable;
    whereType(type: Enums.CoreTransactionType | Enums.SolarTransactionType | number): QueryIterable;
    whereTypeGroup(typeGroup: Enums.TransactionTypeGroup | number): QueryIterable;
    whereVersion(version: number): QueryIterable;
    whereKind(transaction: Interfaces.ITransaction): QueryIterable;

    has(): boolean;
    first(): Interfaces.ITransaction;
}

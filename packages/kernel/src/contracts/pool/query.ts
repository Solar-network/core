import { Interfaces } from "@solar-network/crypto";

export type QueryPredicate = (transaction: Interfaces.ITransaction) => boolean;

export interface Query {
    getAll(): QueryIterable;
    getAllBySender(senderId: string): QueryIterable;
    getFromLowestPriority(): QueryIterable;
    getFromHighestPriority(): QueryIterable;
}

export interface QueryIterable extends Iterable<Interfaces.ITransaction> {
    wherePredicate(predicate: QueryPredicate): QueryIterable;
    whereId(id: string): QueryIterable;
    whereType(type: string): QueryIterable;
    whereVersion(version: number): QueryIterable;
    whereKind(transaction: Interfaces.ITransaction): QueryIterable;

    has(): boolean;
    first(): Interfaces.ITransaction;
}

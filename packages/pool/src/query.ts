import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { Comparator, IteratorMany } from "./utils";

export class QueryIterable implements Contracts.Pool.QueryIterable {
    public transactions: Iterable<Interfaces.ITransaction>;
    public predicate?: Contracts.Pool.QueryPredicate;

    public constructor(transactions: Iterable<Interfaces.ITransaction>, predicate?: Contracts.Pool.QueryPredicate) {
        this.transactions = transactions;
        this.predicate = predicate;
    }

    public *[Symbol.iterator](): Iterator<Interfaces.ITransaction> {
        for (const transaction of this.transactions) {
            if (!this.predicate || this.predicate(transaction)) {
                yield transaction;
            }
        }
    }

    public wherePredicate(predicate: Contracts.Pool.QueryPredicate): QueryIterable {
        return new QueryIterable(this, predicate);
    }

    public whereId(id: string): QueryIterable {
        return this.wherePredicate((t) => t.id === id);
    }

    public whereType(type: string): QueryIterable {
        return this.wherePredicate((t) => t.data.type === type);
    }

    public whereVersion(version: number): QueryIterable {
        return this.wherePredicate((t) => t.data.version === version);
    }

    public whereKind(transaction: Interfaces.ITransaction): QueryIterable {
        return this.wherePredicate((t) => t.data.type === transaction.data.type);
    }

    public has(): boolean {
        for (const _ of this) {
            return true;
        }
        return false;
    }

    public first(): Interfaces.ITransaction {
        for (const transaction of this) {
            return transaction;
        }
        throw new Error("Transaction not found");
    }
}

@Container.injectable()
export class Query implements Contracts.Pool.Query {
    @Container.inject(Container.Identifiers.PoolMempool)
    private readonly mempool!: Contracts.Pool.Mempool;

    public getAll(): QueryIterable {
        const iterable: Iterable<Interfaces.ITransaction> = function* (this: Query) {
            for (const senderMempool of this.mempool.getSenderMempools()) {
                for (const transaction of senderMempool.getFromLatest()) {
                    yield transaction;
                }
            }
        }.bind(this)();

        return new QueryIterable(iterable);
    }

    public getAllBySender(senderId: string): QueryIterable {
        const iterable: Iterable<Interfaces.ITransaction> = function* (this: Query) {
            if (this.mempool.hasSenderMempool(senderId)) {
                const transactions = this.mempool.getSenderMempool(senderId).getFromEarliest();
                for (const transaction of transactions) {
                    yield transaction;
                }
            }
        }.bind(this)();

        return new QueryIterable(iterable);
    }

    public getFromLowestPriority(): QueryIterable {
        const iterable = {
            [Symbol.iterator]: () => {
                const comparator: Comparator<Interfaces.ITransaction> = (
                    a: Interfaces.ITransaction,
                    b: Interfaces.ITransaction,
                ) => {
                    return a.data.fee.comparedTo(b.data.fee);
                };

                const iterators: Iterator<Interfaces.ITransaction>[] = Array.from(this.mempool.getSenderMempools())
                    .map((p) => p.getFromLatest())
                    .map((i) => i[Symbol.iterator]());

                return new IteratorMany<Interfaces.ITransaction>(iterators, comparator);
            },
        };

        return new QueryIterable(iterable);
    }

    public getFromHighestPriority(): QueryIterable {
        const iterable = {
            [Symbol.iterator]: () => {
                const comparator: Comparator<Interfaces.ITransaction> = (
                    a: Interfaces.ITransaction,
                    b: Interfaces.ITransaction,
                ) => {
                    return b.data.fee.comparedTo(a.data.fee);
                };

                const iterators: Iterator<Interfaces.ITransaction>[] = Array.from(this.mempool.getSenderMempools())
                    .map((p) => p.getFromEarliest())
                    .map((i) => i[Symbol.iterator]());

                return new IteratorMany<Interfaces.ITransaction>(iterators, comparator);
            },
        };

        return new QueryIterable(iterable);
    }
}

import { cpus } from "os";

const workerCount: number = Math.min(Math.max(1, Math.floor(cpus().length / 2)), 3);

export const defaults = {
    storage: `${process.env.SOLAR_CORE_PATH_DATA}/pool/pool.sqlite`,
    // When the pool contains that many transactions, then a new transaction is
    // only accepted if its fee is higher than the transaction with the lowest
    // fee in the pool. In this case the transaction with the lowest fee is removed
    // from the pool in order to accommodate the new one.
    maxTransactionsInPool: process.env.SOLAR_CORE_MAX_TRANSACTIONS_IN_POOL || 15000,
    maxTransactionsPerSender: process.env.SOLAR_CORE_POOL_MAX_PER_SENDER || 150,
    allowedSenders: [],
    maxTransactionsPerRequest: process.env.SOLAR_CORE_POOL_MAX_PER_REQUEST || 40,
    // Max transaction age in number of blocks produced since the transaction was created.
    // If a transaction stays that long in the pool without being included in any block,
    // then it will be removed.
    maxTransactionAge: 2700,
    maxTransactionBytes: 2000000, // TODO think of a value that makes sense ?
    workerPool: {
        workerCount,
    },
};

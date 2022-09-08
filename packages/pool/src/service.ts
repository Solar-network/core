import { Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Enums, Providers, Utils as AppUtils } from "@solar-network/kernel";

import { PoolFullError, TransactionAlreadyInPoolError } from "./errors";

@Container.injectable()
export class Service implements Contracts.Pool.Service {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.PoolDynamicFeeMatcher)
    private readonly dynamicFeeMatcher!: Contracts.Pool.DynamicFeeMatcher;

    @Container.inject(Container.Identifiers.PoolStorage)
    private readonly storage!: Contracts.Pool.Storage;

    @Container.inject(Container.Identifiers.PoolMempool)
    private readonly mempool!: Contracts.Pool.Mempool;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.PoolExpirationService)
    private readonly expirationService!: Contracts.Pool.ExpirationService;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    private readonly lock: AppUtils.Lock = new AppUtils.Lock();

    private disposed = false;

    public async boot(): Promise<void> {
        this.events.listen(Enums.BlockEvent.Applied, this);
        this.events.listen(Enums.CryptoEvent.MilestoneChanged, this);
        this.events.listen(Enums.QueueEvent.Finished, this);
        this.events.listen(Enums.RoundEvent.Applied, this);

        if (process.env.CORE_RESET_DATABASE || process.env.CORE_RESET_POOL) {
            await this.flush();
        }
    }

    public dispose(): void {
        this.events.forget(Enums.BlockEvent.Applied, this);
        this.events.forget(Enums.CryptoEvent.MilestoneChanged, this);
        this.events.forget(Enums.QueueEvent.Finished, this);
        this.events.forget(Enums.RoundEvent.Applied, this);

        this.disposed = true;
    }

    public async handle({ name }: { name: string; data: object }): Promise<void> {
        try {
            switch (name) {
                case Enums.BlockEvent.Applied:
                    await this.cleanUp();
                    break;
                case Enums.CryptoEvent.MilestoneChanged:
                    await this.readdTransactions([], true);
                    break;
                case Enums.QueueEvent.Finished:
                    if (this.getPoolSize() <= 7500) {
                        await this.readdTransactions([], true);
                    }
                    break;
                case Enums.RoundEvent.Applied:
                    if (this.getPoolSize() > 7500) {
                        await this.readdTransactions([], true);
                    }
                    break;
            }
        } catch (error) {
            this.logger.critical(error.stack);
            throw error;
        }
    }

    public getPoolSize(): number {
        return this.mempool.getSize();
    }

    public async addTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        await this.lock.runNonExclusive(async () => {
            if (this.disposed) {
                return;
            }

            AppUtils.assert.defined<string>(transaction.id);
            AppUtils.assert.defined<string>(transaction.data.senderId);

            if (this.storage.hasTransaction(transaction.id)) {
                throw new TransactionAlreadyInPoolError(transaction);
            }

            this.storage.addTransaction({
                height: this.stateStore.getLastHeight(),
                id: transaction.id,
                recipientId: (transaction.addresses.recipientId || []).join(","),
                senderId: transaction.data.senderId,
                serialised: transaction.serialised,
            });

            try {
                await this.dynamicFeeMatcher.throwIfCannotEnterPool(transaction);
                await this.addTransactionToMempool(transaction);
                this.logger.debug(`${transaction} added to the pool`);
                this.events.dispatch(Enums.TransactionEvent.AddedToPool, transaction.data);
            } catch (error) {
                this.storage.removeTransaction(transaction.id);
                this.logger.warning(`${transaction} failed to enter the pool: ${error.message} :warning:`);
                this.events.dispatch(Enums.TransactionEvent.RejectedByPool, transaction.data);

                throw error instanceof Contracts.Pool.PoolError
                    ? error
                    : new Contracts.Pool.PoolError(error.message, "ERR_OTHER");
            }
        });
    }

    public async readdTransactions(
        previouslyForgedTransactions: Interfaces.ITransaction[] = [],
        recheckValidity: boolean = false,
    ): Promise<void> {
        await this.lock.runExclusive(async () => {
            if (this.disposed) {
                return;
            }

            this.mempool.flush();

            let previouslyForgedSuccesses = 0;
            let previouslyForgedFailures = 0;
            let previouslyStoredSuccesses = 0;
            let previouslyStoredExpirations = 0;
            let previouslyStoredFailures = 0;

            const previouslyForgedStoredIds: string[] = [];

            for (const { addresses, id, serialised } of previouslyForgedTransactions) {
                try {
                    const previouslyForgedTransaction = Transactions.TransactionFactory.fromBytesUnsafe(
                        serialised,
                        id,
                        addresses,
                    );

                    AppUtils.assert.defined<string>(previouslyForgedTransaction.id);
                    AppUtils.assert.defined<string>(previouslyForgedTransaction.data.senderId);

                    await this.addTransactionToMempool(previouslyForgedTransaction);

                    this.storage.addTransaction({
                        height: this.stateStore.getLastHeight(),
                        id: previouslyForgedTransaction.id,
                        recipientId: (previouslyForgedTransaction.addresses.recipientId || []).join(","),
                        senderId: previouslyForgedTransaction.data.senderId,
                        serialised: previouslyForgedTransaction.serialised,
                    });

                    previouslyForgedStoredIds.push(previouslyForgedTransaction.id);

                    previouslyForgedSuccesses++;
                } catch (error) {
                    this.logger.debug(
                        `Failed to re-add previously forged transaction ${id} to the pool: ${error.message} :warning:`,
                    );
                    previouslyForgedFailures++;
                }
            }

            const maxTransactionAge: number = this.configuration.getRequired<number>("maxTransactionAge");
            const lastHeight: number = this.stateStore.getLastHeight();
            const expiredHeight: number = lastHeight - maxTransactionAge;

            for (const { height, id, recipientId, senderId, serialised } of this.storage.getAllTransactions()) {
                if (previouslyForgedStoredIds.includes(id)) {
                    continue;
                }

                if (height > expiredHeight) {
                    try {
                        const addresses: Interfaces.IDeserialiseAddresses = {
                            senderId,
                            recipientId: (recipientId || "").split(","),
                        };
                        if (addresses.recipientId![0].length === 0) {
                            delete addresses.recipientId;
                        }

                        const previouslyStoredTransaction = Transactions.TransactionFactory.fromBytesUnsafe(
                            serialised,
                            id,
                            addresses,
                        );
                        await this.addTransactionToMempool(previouslyStoredTransaction);
                        previouslyStoredSuccesses++;
                    } catch (error) {
                        this.storage.removeTransaction(id);
                        if (!recheckValidity) {
                            this.logger.debug(
                                `Failed to re-add previously stored transaction ${id} to the pool: ${error.message} :warning:`,
                            );
                        }
                        previouslyStoredFailures++;
                    }
                } else {
                    this.storage.removeTransaction(id);
                    this.logger.debug(`Not re-adding previously stored expired transaction to the pool: ${id}`);
                    previouslyStoredExpirations++;
                }
            }

            if (!recheckValidity && previouslyForgedSuccesses >= 1) {
                this.logger.info(
                    `${AppUtils.pluralise(
                        "previously forged transaction",
                        previouslyForgedSuccesses,
                        true,
                    )} re-added to the pool :money_with_wings:`,
                );
            }
            if (previouslyForgedFailures >= 1) {
                this.logger.warning(
                    `${AppUtils.pluralise(
                        "previously forged transaction",
                        previouslyForgedFailures,
                        true,
                    )} could not be re-added to the pool :warning:`,
                );
            }
            if (!recheckValidity && previouslyStoredSuccesses >= 1) {
                this.logger.info(
                    `${AppUtils.pluralise(
                        "previously stored transaction",
                        previouslyStoredSuccesses,
                        true,
                    )} re-added to the pool :money_with_wings:`,
                );
            }
            if (previouslyStoredExpirations >= 1) {
                this.logger.info(
                    `${AppUtils.pluralise("transaction", previouslyStoredExpirations, true)} in the pool expired :zap:`,
                );
            }
            if (previouslyStoredFailures >= 1) {
                if (recheckValidity) {
                    this.logger.warning(
                        `${AppUtils.pluralise(
                            "transaction",
                            previouslyStoredFailures,
                            true,
                        )} removed from the pool as ${
                            previouslyStoredFailures !== 1 ? "they are" : "it is"
                        } no longer valid :zap:`,
                    );
                } else {
                    this.logger.warning(
                        `${AppUtils.pluralise(
                            "previously stored transaction",
                            previouslyStoredFailures,
                            true,
                        )} could not be re-added to the pool :warning:`,
                    );
                }
            }
        });
    }

    public async removeTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        await this.lock.runNonExclusive(async () => {
            if (this.disposed) {
                return;
            }

            AppUtils.assert.defined<string>(transaction.id);
            AppUtils.assert.defined<string>(transaction.data.senderId);

            if (!this.storage.hasTransaction(transaction.id)) {
                return;
            }

            const removedTransactions = await this.mempool.removeTransaction(transaction.data.senderId, transaction.id);

            for (const removedTransaction of removedTransactions) {
                AppUtils.assert.defined<string>(removedTransaction.id);
                this.storage.removeTransaction(removedTransaction.id);
                this.logger.debug(`Removed ${removedTransaction} from the pool`);
                this.events.dispatch(Enums.TransactionEvent.RemovedFromPool, removedTransaction.data);
            }

            if (!removedTransactions.find((t) => t.id === transaction.id)) {
                this.storage.removeTransaction(transaction.id);
                this.events.dispatch(Enums.TransactionEvent.RemovedFromPool, transaction.data);
            }
        });
    }

    public async removeForgedTransaction(transaction: Interfaces.ITransaction): Promise<void> {
        await this.lock.runNonExclusive(async () => {
            if (this.disposed) {
                return;
            }

            AppUtils.assert.defined<string>(transaction.id);
            AppUtils.assert.defined<string>(transaction.data.senderId);

            if (!this.storage.hasTransaction(transaction.id)) {
                return;
            }

            const removedTransactions = await this.mempool.removeForgedTransaction(
                transaction.data.senderId,
                transaction.id,
            );

            for (const removedTransaction of removedTransactions) {
                AppUtils.assert.defined<string>(removedTransaction.id);
                this.storage.removeTransaction(removedTransaction.id);
                this.logger.debug(`Removed forged ${removedTransaction} from the pool`);
            }

            if (!removedTransactions.find((t) => t.id === transaction.id)) {
                this.storage.removeTransaction(transaction.id);
                this.logger.error(`Removed forged ${transaction} from the pool storage`);
            }
        });
    }

    public async cleanUp(): Promise<void> {
        await this.lock.runNonExclusive(async () => {
            if (this.disposed) {
                return;
            }

            await this.removeOldTransactions();
            await this.removeExpiredTransactions();
            await this.removeLowestPriorityTransactions();
        });
    }

    public async flush(): Promise<void> {
        await this.lock.runExclusive(async () => {
            if (this.disposed) {
                return;
            }

            this.mempool.flush();
            this.storage.flush();
        });
    }

    public getPoolWallet(address: string): Contracts.State.Wallet | undefined {
        if (!this.mempool.hasSenderMempool(address)) {
            return undefined;
        }

        return this.mempool.getSenderMempool(address).getWallet();
    }

    private async removeOldTransactions(): Promise<void> {
        const maxTransactionAge: number = this.configuration.getRequired<number>("maxTransactionAge");
        const lastHeight: number = this.stateStore.getLastHeight();
        const expiredHeight: number = lastHeight - maxTransactionAge;

        for (const { senderId, id } of this.storage.getOldTransactions(expiredHeight)) {
            const removedTransactions = await this.mempool.removeTransaction(senderId, id);

            for (const removedTransaction of removedTransactions) {
                AppUtils.assert.defined<string>(removedTransaction.id);
                this.storage.removeTransaction(removedTransaction.id);
                this.logger.info(`Removed old ${removedTransaction} from the pool`);
                this.events.dispatch(Enums.TransactionEvent.Expired, removedTransaction.data);
            }
        }
    }

    private async removeExpiredTransactions(): Promise<void> {
        for (const transaction of this.poolQuery.getAll()) {
            AppUtils.assert.defined<string>(transaction.id);
            AppUtils.assert.defined<string>(transaction.data.senderId);

            if (this.expirationService.isExpired(transaction)) {
                const removedTransactions = await this.mempool.removeTransaction(
                    transaction.data.senderId,
                    transaction.id,
                );

                for (const removedTransaction of removedTransactions) {
                    AppUtils.assert.defined<string>(removedTransaction.id);
                    this.storage.removeTransaction(removedTransaction.id);
                    this.logger.info(`Removed expired ${removedTransaction} from the pool`);
                    this.events.dispatch(Enums.TransactionEvent.Expired, removedTransaction.data);
                }
            }
        }
    }

    private async removeLowestPriorityTransaction(): Promise<void> {
        if (this.getPoolSize() === 0) {
            return;
        }

        const transaction = this.poolQuery.getFromLowestPriority().first();

        AppUtils.assert.defined<string>(transaction.id);
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const removedTransactions = await this.mempool.removeTransaction(transaction.data.senderId, transaction.id);

        for (const removedTransaction of removedTransactions) {
            AppUtils.assert.defined<string>(removedTransaction.id);
            this.storage.removeTransaction(removedTransaction.id);
            this.logger.info(`Removed lowest priority ${removedTransaction} from the pool`);
            this.events.dispatch(Enums.TransactionEvent.RemovedFromPool, removedTransaction.data);
        }
    }

    private async removeLowestPriorityTransactions(): Promise<void> {
        const maxTransactionsInPool: number = this.configuration.getRequired<number>("maxTransactionsInPool");

        while (this.getPoolSize() > maxTransactionsInPool) {
            await this.removeLowestPriorityTransaction();
        }
    }

    private async addTransactionToMempool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const maxTransactionsInPool: number = this.configuration.getRequired<number>("maxTransactionsInPool");

        if (this.getPoolSize() >= maxTransactionsInPool) {
            await this.removeOldTransactions();
            await this.removeExpiredTransactions();
            await this.removeLowestPriorityTransactions();
        }

        if (this.getPoolSize() >= maxTransactionsInPool) {
            const lowest = this.poolQuery.getFromLowestPriority().first();
            if (transaction.data.fee.isLessThanEqual(lowest.data.fee)) {
                throw new PoolFullError(transaction, lowest.data.fee);
            }

            await this.removeLowestPriorityTransaction();
        }

        await this.mempool.addTransaction(transaction);
    }
}

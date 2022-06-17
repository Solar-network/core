import { Repositories } from "@solar-network/core-database";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Enums, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import delay from "delay";

import { AlreadyForgedTransactionError, AlreadyTriedTransactionError, InvalidTransactionDataError } from "./errors";

@Container.injectable()
export class Processor implements Contracts.TransactionPool.Processor {
    @Container.multiInject(Container.Identifiers.TransactionPoolProcessorExtension)
    @Container.optional()
    private readonly extensions: Contracts.TransactionPool.ProcessorExtension[] = [];

    @Container.inject(Container.Identifiers.TransactionPoolService)
    private readonly pool!: Contracts.TransactionPool.Service;

    @Container.inject(Container.Identifiers.TransactionPoolWorkerPool)
    private readonly workerPool!: Contracts.TransactionPool.WorkerPool;

    @Container.inject(Container.Identifiers.PeerTransactionBroadcaster)
    @Container.optional()
    private readonly transactionBroadcaster!: Contracts.P2P.TransactionBroadcaster | undefined;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    private cachedTransactions: Map<string, number> = new Map();

    public async process(
        data: Interfaces.ITransactionData[] | Buffer[],
    ): Promise<Contracts.TransactionPool.ProcessorResult> {
        const accept: string[] = [];
        const broadcast: string[] = [];
        const invalid: string[] = [];
        const excess: string[] = [];
        let errors: { [id: string]: Contracts.TransactionPool.ProcessorError } | undefined = undefined;

        const broadcastTransactions: Interfaces.ITransaction[] = [];
        const transactions: Interfaces.ITransaction[] = [];
        const timeNow: number = Math.ceil(new Date().getTime() / 1000);
        const expirySeconds: number = 30;

        const handleError = (entryId: string, error: Error) => {
            invalid.push(entryId);

            if (error instanceof Contracts.TransactionPool.PoolError) {
                if (error.type === "ERR_EXCEEDS_MAX_COUNT") {
                    excess.push(entryId);
                }

                if (!errors) errors = {};
                errors[entryId] = {
                    type: error.type,
                    message: error.message,
                };
            } else {
                throw error;
            }
        };

        for (const [id, expiryTime] of this.cachedTransactions.entries()) {
            if (timeNow - expiryTime >= expirySeconds) {
                this.cachedTransactions.delete(id);
            }
        }

        try {
            for (let i = 0; i < data.length; i++) {
                const transactionData = data[i];
                const entryId = transactionData instanceof Buffer ? String(i) : transactionData.id ?? String(i);

                try {
                    const transaction =
                        transactionData instanceof Buffer
                            ? await this.getTransactionFromBuffer(transactionData)
                            : await this.getTransactionFromData(transactionData);
                    if (transaction.id && !this.cachedTransactions.has(transaction.id)) {
                        this.cachedTransactions.set(transaction.id, timeNow);
                        transactions.push(transaction);
                    } else if (transaction.id) {
                        throw new AlreadyTriedTransactionError(
                            transaction,
                            expirySeconds - (timeNow - this.cachedTransactions.get(transaction.id)!),
                        );
                    }
                } catch (error) {
                    handleError(entryId, error);
                }
                await delay(1);
            }

            const forgedTransactionIds: string[] =
                transactions.length > 0
                    ? await this.transactionRepository.getForgedTransactionsIds(
                          transactions.map((transaction) => transaction.data.id!),
                      )
                    : [];

            for (let i = 0; i < transactions.length; i++) {
                const transaction = transactions[i];
                const entryId = transaction.data && transaction.data.id ? transaction.data.id : String(i);
                try {
                    if (forgedTransactionIds.includes(entryId)) {
                        throw new AlreadyForgedTransactionError(transaction);
                    }
                    await this.pool.addTransaction(transaction);
                    accept.push(entryId);

                    try {
                        await Promise.all(this.extensions.map((e) => e.throwIfCannotBroadcast(transaction)));
                        broadcastTransactions.push(transaction);
                        broadcast.push(entryId);
                    } catch {
                        //
                    }
                } catch (error) {
                    handleError(entryId, error);
                }
                await delay(1);
            }
        } finally {
            if (this.transactionBroadcaster && broadcastTransactions.length !== 0) {
                this.transactionBroadcaster
                    .broadcastTransactions(broadcastTransactions)
                    .catch((error) => this.logger.error(error.stack));
            }
        }

        return {
            accept,
            broadcast,
            invalid,
            excess,
            errors,
        };
    }

    private async getTransactionFromBuffer(transactionData: Buffer): Promise<Interfaces.ITransaction> {
        try {
            const transactionCommon = {} as Interfaces.ITransactionData;
            const txByteBuffer = new Utils.ByteBuffer(transactionData);
            Transactions.Deserialiser.deserialiseCommon(transactionCommon, txByteBuffer);

            if (this.workerPool.isTypeGroupSupported(transactionCommon.typeGroup || Enums.TransactionTypeGroup.Core)) {
                return await this.workerPool.getTransactionFromData(transactionData);
            } else {
                return Transactions.TransactionFactory.fromBytes(transactionData);
            }
        } catch (error) {
            throw new InvalidTransactionDataError(error.message);
        }
    }

    private async getTransactionFromData(
        transactionData: Interfaces.ITransactionData,
    ): Promise<Interfaces.ITransaction> {
        try {
            if (this.workerPool.isTypeGroupSupported(transactionData.typeGroup || Enums.TransactionTypeGroup.Core)) {
                return await this.workerPool.getTransactionFromData(transactionData);
            } else {
                return Transactions.TransactionFactory.fromData(transactionData);
            }
        } catch (error) {
            throw new InvalidTransactionDataError(error.message);
        }
    }
}

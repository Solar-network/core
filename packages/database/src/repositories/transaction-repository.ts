import { Crypto } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import dayjs from "dayjs";
import { cpus } from "os";

import { TransactionModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class TransactionRepository
    extends Repository<TransactionModel>
    implements Contracts.Database.TransactionRepository
{
    protected model: typeof TransactionModel = TransactionModel;

    public async findTransactionsById(ids: string[]): Promise<TransactionModel[]> {
        return this.toModel(
            TransactionModel,
            await this.getFullQueryBuilder()
                .where(
                    `transactions.id IN (${ids.map(() => "?").join(",")})`,
                    ids.map((id: string) => Buffer.from(id, "hex")),
                )
                .run(),
        );
    }

    public async findTransactionById(id: string): Promise<TransactionModel> {
        return (await this.findTransactionsById([id]))?.[0];
    }

    public async findByBlockHeights(blockHeights: number[]): Promise<
        Array<{
            id: string;
            blockHeight: number;
            serialised: Buffer;
        }>
    > {
        return this.toModel(
            TransactionModel,
            await this.createQueryBuilder()
                .select("id")
                .select("block_height", "blockHeight")
                .select("serialised")
                .from("transactions")
                .where(`block_height IN (${blockHeights.map(() => "?").join(",")})`, blockHeights)
                .orderBy("sequence", "ASC")
                .run(),
        );
    }

    public async getConfirmedTransactionIds(ids: string[]): Promise<string[]> {
        const transactions = this.toModel(
            TransactionModel,
            await this.createQueryBuilder()
                .select("id")
                .from("transactions")
                .where(
                    `transactions.id IN (${ids.map(() => "?").join(",")})`,
                    ids.map((id: string) => Buffer.from(id, "hex")),
                )
                .run(),
        );

        return transactions.map((t) => t.id);
    }

    public async getStatistics(): Promise<{
        count: number;
        totalFee: string;
    }> {
        return (
            await this.createQueryBuilder()
                .select("COUNT(DISTINCT(id))", "count")
                .select("CAST(COALESCE(SUM(fee), 0) AS TEXT)", "totalFee")
                .from("transactions")
                .run()
        )[0];
    }

    public async getFeeStatistics(
        txTypes: Array<{ type: string }>,
        days?: number,
        minFee?: number,
    ): Promise<Contracts.Database.FeeStatistics[]> {
        minFee = minFee || 0;

        if (days) {
            const age = Crypto.Slots.getTime(dayjs().subtract(days, "day").valueOf());

            return this.createQueryBuilder()
                .select("(SELECT type FROM types WHERE types.id = transactions.type_id LIMIT 1)", "type")
                .select("CAST(CAST(COALESCE(AVG(fee), 0) AS INTEGER) AS TEXT)", "avg")
                .select("CAST(COALESCE(MIN(fee), 0) AS TEXT)", "min")
                .select("CAST(COALESCE(MAX(fee), 0) AS TEXT)", "max")
                .select("CAST(COALESCE(SUM(fee), 0) AS TEXT)", "sum")
                .select("CAST(COALESCE(SUM(fee * burned_fee_percent / 100), 0) AS TEXT)", "burned")
                .from("transactions")
                .where("timestamp >= :age AND fee >= :minFee", { age, minFee })
                .groupBy("type_id")
                .orderBy("type", "ASC")
                .run();
        }

        const feeStatistics: Contracts.Database.FeeStatistics[] = [];

        for (const feeStatsByType of txTypes) {
            const feeStatsForType: Contracts.Database.FeeStatistics = (
                await this.createQueryBuilder()
                    .select("type")
                    .select("CAST(CAST(COALESCE(AVG(fee), 0) AS INTEGER) AS TEXT)", "avg")
                    .select("CAST(COALESCE(MIN(fee), 0) AS TEXT)", "min")
                    .select("CAST(COALESCE(MAX(fee), 0) AS TEXT)", "max")
                    .select("CAST(COALESCE(SUM(fee), 0) AS TEXT)", "sum")
                    .from(
                        `(
                            SELECT fee, type FROM transactions
                            LEFT JOIN types ON types.id = transactions.type_id
                            WHERE type = '${feeStatsByType.type}'
                            ORDER BY block_height DESC, sequence DESC
                            LIMIT 0, 20
                        )`,
                        "transactions",
                    )
                    .groupBy("type")
                    .run()
            )[0];

            const burnStatsForType: Contracts.Database.FeeStatistics = (
                await this.createQueryBuilder()
                    .select("CAST(COALESCE(SUM(burned_fee), 0) AS TEXT)", "burned")
                    .from(
                        `(
                        SELECT fee * burned_fee_percent / 100 burned_fee, type FROM transactions
                        LEFT JOIN types ON types.id = transactions.type_id
                        WHERE type = '${feeStatsByType.type}'
                    )`,
                        "transactions",
                    )
                    .groupBy("type")
                    .run()
            )[0];

            if (feeStatsForType && burnStatsForType) {
                feeStatsForType.burned = burnStatsForType.burned;
            }

            feeStatistics.push(
                feeStatsForType ?? {
                    type: feeStatsByType.type,
                    avg: "0",
                    burned: "0",
                    min: "0",
                    max: "0",
                    sum: "0",
                },
            );
        }
        return feeStatistics;
    }

    public async getFeesBurned(): Promise<string> {
        const { burned } = (
            await this.createQueryBuilder()
                .select("CAST(COALESCE(SUM(fee * burned_fee_percent / 100), 0) AS TEXT)", "burned")
                .from("transactions")
                .run()
        )[0];
        return burned;
    }

    public async getBurnTransactionTotal(): Promise<string> {
        const { amount } = (
            await this.createQueryBuilder()
                .select(
                    "CAST(COALESCE(SUM((SELECT amount_sent FROM balance_changes WHERE balance_changes.transactions_row = transactions.row)), 0) AS TEXT)",
                    "amount",
                )
                .from("transactions")
                .where("type_id = (SELECT id FROM types WHERE type = 'burn')")
                .run()
        )[0];
        return amount;
    }

    public async getSentTransactions(): Promise<{ senderId: string; fee: string; nonce: string }[]> {
        return (
            await this.createQueryBuilder()
                .select("(SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1)", "senderId")
                .select("CAST(SUM(fee) AS TEXT)", "fee")
                .select("COUNT(nonce)", "nonce")
                .from("transactions")
                .groupBy("identity_id")
                .run()
        ).map((transaction) => {
            const { senderId, fee, nonce } = transaction;
            return {
                senderId,
                fee,
                nonce,
            };
        });
    }

    public async *fetchByExpression(
        expression: Contracts.Search.Expression<TransactionModel>,
        sorting: Contracts.Search.Sorting = [],
    ): AsyncIterable<TransactionModel> {
        const countQueryBuilder = this.createQueryBuilder().select("COUNT(*)", "count").from("transactions");
        this.addWhere(countQueryBuilder, expression);
        const workers: number = cpus().length;
        const count: number = Math.ceil((await countQueryBuilder.run())[0].count / workers);
        const promises: Promise<any>[] = [];

        for (let i = 0; i < workers; i++) {
            const queryBuilder = this.getFullQueryBuilder();
            this.addWhere(queryBuilder, expression);
            this.addOrderBy(queryBuilder, sorting);
            queryBuilder.limit(i * count, count);
            promises.push(queryBuilder.run());
        }

        const transactions = this.toModel(
            this.model,
            (await Promise.all(promises)).flatMap((t: TransactionModel) => t),
        );
        transactions.sort((a: TransactionModel, b: TransactionModel) => {
            const diff = a.blockHeight - b.blockHeight;

            if (diff === 0) {
                return a.sequence - b.sequence;
            }

            return diff;
        });

        for await (const raw of transactions) {
            yield raw;
        }
    }

    protected getFullQueryBuilder(): Contracts.Database.QueryBuilder {
        return this.createQueryBuilder()
            .select("transactions.*")
            .select("block_height", "blockHeight")
            .select("CAST(fee * burned_fee_percent / 100 AS INTEGER)", "burnedFee")
            .select(
                "(SELECT identity FROM identities WHERE identities.id = transactions.identity_id LIMIT 1)",
                "senderId",
            )
            .select(
                "(SELECT public_key FROM public_keys WHERE public_keys.id = transactions.public_key_id LIMIT 1)",
                "senderPublicKey",
            )
            .select("(SELECT type FROM types WHERE types.id = transactions.type_id LIMIT 1)", "type")
            .from("transactions");
    }
}

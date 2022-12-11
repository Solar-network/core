import { Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums, Utils as AppUtils } from "@solar-network/kernel";

import { BlockModel, MissedBlockModel, RoundModel, TransactionModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class BlockRepository extends Repository<BlockModel> implements Contracts.Database.BlockRepository {
    protected model: typeof BlockModel = BlockModel;

    public async findBlocksById(ids: string[]): Promise<BlockModel[]> {
        return this.toModel(
            BlockModel,
            await this.getFullQueryBuilder()
                .where(
                    `blocks.id IN (${ids.map(() => "?").join(",")})`,
                    ids.map((id: string) => Buffer.from(id, "hex")),
                )
                .run(),
        );
    }

    public async findBlockById(id: string): Promise<BlockModel> {
        return (await this.findBlocksById[id])[0];
    }

    public async findLatest(): Promise<Interfaces.IBlockData | undefined> {
        return this.toModel(
            BlockModel,
            await this.getFullQueryBuilder().orderBy("height", "DESC").limit(0, 1).run(),
        )[0];
    }

    public async findTop(limit: number): Promise<BlockModel[]> {
        return this.toModel(
            BlockModel,
            await this.getFullQueryBuilder().orderBy("height", "DESC").limit(0, limit).run(),
        );
    }

    public async findByHeight(height: number): Promise<BlockModel | undefined> {
        const block = this.toModel(
            BlockModel,
            await this.getFullQueryBuilder().where("height = :height", { height }).run(),
        )[0];

        if (block) {
            return block;
        }

        return undefined;
    }

    public async findByHeights(heights: number[]): Promise<BlockModel[]> {
        return this.toModel(
            BlockModel,
            await this.getFullQueryBuilder()
                .where(`height IN (${heights.map(() => "?").join(",")})`, heights)
                .run(),
        );
    }

    public async findByHeightRange(start: number, end: number): Promise<BlockModel[]> {
        return this.toModel(
            BlockModel,
            await this.getFullQueryBuilder()
                .where("height BETWEEN :start AND :end", { start, end })
                .orderBy("height", "ASC")
                .run(),
        );
    }

    public async findByHeightRangeWithTransactionsForDownload(
        start: number,
        end: number,
    ): Promise<Contracts.Shared.DownloadBlock[]> {
        const blocks = await this.findByHeightRangeWithTransactionsRaw(start, end, true);
        return blocks.map((block) => {
            const blockModel: BlockModel & { transactions?: string[] } = this.toModel(BlockModel, [block])[0];
            blockModel.transactions = block.transactions;
            return blockModel;
        }) as Contracts.Shared.DownloadBlock[];
    }

    public async findByHeightRangeWithTransactions(start: number, end: number): Promise<Interfaces.IBlockData[]> {
        const blocks = await this.findByHeightRangeWithTransactionsRaw(start, end, false);
        return blocks.map((block) => {
            const blockModel: BlockModel & { transactions?: Interfaces.ITransactionData[] } = this.toModel(BlockModel, [
                block,
            ])[0];
            blockModel.transactions = block.transactions;
            return blockModel;
        }) as Interfaces.IBlockData[];
    }

    public async getStatistics(): Promise<{
        numberOfTransactions: number;
        totalFee: string;
        count: number;
    }> {
        return (
            await this.createQueryBuilder()
                .select("COALESCE(SUM(number_of_transactions), 0)", "numberOfTransactions")
                .select("CAST(COALESCE(SUM(total_fee), 0) AS TEXT)", "totalFee")
                .select("COUNT(DISTINCT(height))", "count")
                .from("blocks")
                .run()
        )[0];
    }

    public async getBlockRewards(): Promise<{ username: string; rewards: string }[]> {
        return this.createQueryBuilder()
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .select(
                "CAST(SUM(reward + total_fee - (SELECT COALESCE(SUM(BURN(block_height, fee)), 0) FROM transactions WHERE block_height = height)) AS TEXT)",
                "rewards",
            )
            .from("blocks")
            .groupBy("identity_id")
            .run();
    }

    public async getDelegatesForgedBlocks(): Promise<
        {
            username: string;
            height: number;
            totalRewards: string;
            donations: string;
            totalFees: string;
            totalFeesBurned: string;
            totalProduced: number;
        }[]
    > {
        const rewardsAndFees = await this.createQueryBuilder()
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .select("CAST(SUM(total_fee) AS TEXT)", "totalFees")
            .select(
                "CAST(SUM((SELECT COALESCE(SUM(BURN(block_height, fee)), 0) FROM transactions WHERE block_height = height)) AS TEXT)",
                "totalFeesBurned",
            )
            .select("CAST(SUM(reward) AS TEXT)", "totalRewards")
            .select("CAST(COUNT(total_amount) AS TEXT)", "totalProduced")
            .from("blocks")
            .groupBy("identity_id")
            .run();

        const donations = await this.calculateDonations();

        for (const donation of donations) {
            const delegate = rewardsAndFees.find((block) => block.username === donation.username);
            if (delegate.donations) {
                delegate.donations = delegate.donations.plus(donation.amount);
            } else {
                delegate.donations = donation.amount;
            }
        }

        return rewardsAndFees;
    }

    public async calculateDonations(): Promise<{ address: string; amount: Utils.BigNumber; username: string }[]> {
        const donationMilestones = Managers.configManager
            .getMilestones()
            .filter((milestone) => milestone.donations)
            .map((milestone) => milestone.height);
        const result: { address: string; amount: Utils.BigNumber; username: string }[] = [];

        for (let i = 0; i < donationMilestones.length; i++) {
            const height = donationMilestones[i];
            let maxHeight = donationMilestones[i + 1];
            const queryBuilder = this.createQueryBuilder()
                .select(
                    "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                    "username",
                )
                .select("SUM(reward)", "amount")
                .from("blocks");
            if (maxHeight !== undefined) {
                maxHeight--;
                queryBuilder.where("height BETWEEN :height AND :maxHeight", { height, maxHeight });
            } else {
                queryBuilder.where("height >= :height", { height });
            }

            const donations = await queryBuilder.groupBy("identity_id").run();

            for (const donation of donations) {
                const calculatedDonations = Object.entries(
                    Utils.calculateDonations(height, Utils.BigNumber.make(donation.amount)),
                );
                for (const [address, amount] of calculatedDonations) {
                    result.push({ address, amount, username: donation.username });
                }
            }
        }

        return result;
    }

    public async getLastForgedBlocks(): Promise<{ id: string; height: number; username: string; timestamp: number }[]> {
        return this.createQueryBuilder()
            .select("id")
            .select("height")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .select("timestamp")
            .from("blocks")
            .where("height IN (SELECT MAX(height) FROM blocks GROUP BY identity_id)")
            .orderBy("timestamp", "DESC")
            .run();
    }

    public async save(
        blocks: Interfaces.IBlock[],
        missedBlocks: { timestamp: number; height: number; username: string }[],
        rounds: Record<number, { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]>,
        events: Contracts.Kernel.EventDispatcher,
    ): Promise<void> {
        const rawBlocks: Record<string, any>[] = [];
        const rawMissedBlocks: Record<string, any>[] = [];
        const rawRounds: Record<string, any>[] = [];
        const rawTransactions: Record<string, any>[] = [];

        const identities: Map<string, number> = new Map();
        const publicKeys: Map<string, number> = new Map();
        const types: Map<string, number> = new Map();
        const metadata: Map<
            string,
            {
                array: Record<string, string | number | Utils.BigNumber | object>[];
                total?: Utils.BigNumber;
                type: string;
            }
        > = new Map();

        const highestHeight: number = await this.processBlocksAndTransactionsToSave(
            blocks,
            rawBlocks,
            rawTransactions,
            identities,
            publicKeys,
            types,
            metadata,
        );
        this.processRoundsToSave(rounds, rawRounds, publicKeys, highestHeight);
        this.processMissedBlocksToSave(missedBlocks, rawMissedBlocks, identities);

        await this.queryRunner.transaction([
            ...this.saveIdentities(identities),
            ...this.savePublicKeys(publicKeys),
            ...this.saveTypes(types),
            ...this.saveBlocks(rawBlocks),
            ...this.saveMissedBlocks(rawMissedBlocks),
            ...this.saveTransactions(rawTransactions),
            ...this.saveMetadata(metadata),
            ...this.saveRounds(rawRounds),
        ]);

        for (const height of Object.keys(rounds)) {
            if (+height <= highestHeight) {
                events.dispatch(Enums.RoundEvent.Created, rounds[height]);
                delete rounds[height];
            }
        }
        missedBlocks.length = 0;
    }

    public async delete(blocks: Interfaces.IBlockData[]): Promise<void> {
        const continuousChunk = blocks.every((block, i, arr) => {
            return i === 0 ? true : block.height - arr[i - 1].height === 1;
        });

        if (!continuousChunk) {
            throw new Error("Chunk of blocks to delete is not contiguous");
        }

        const lastBlockHeight: number = blocks[blocks.length - 1].height;
        const targetHeight: number = blocks[0].height - 1;
        const roundInfo = AppUtils.roundCalculator.calculateRound(targetHeight);
        const targetRound = roundInfo.round;

        const afterLastBlockCount = (
            await this.createQueryBuilder()
                .select("COUNT()", "count")
                .from("blocks")
                .where("blocks.height > :lastBlockHeight", { lastBlockHeight })
                .run()
        )[0].count;

        if (afterLastBlockCount !== 0) {
            throw new Error("Removing blocks from the middle");
        }

        await this.deleteFromDatabase(targetHeight, targetRound);
    }

    public async deleteTop(count: number): Promise<void> {
        const { maxHeight } = (
            await this.createQueryBuilder().select("MAX(height)", "maxHeight").from("blocks").run()
        )[0];

        const targetHeight = maxHeight - count;
        const roundInfo = AppUtils.roundCalculator.calculateRound(targetHeight);
        const targetRound = roundInfo.round;

        const blockIdRows = await this.createQueryBuilder()
            .select("id")
            .from("blocks")
            .where("height > :targetHeight", { targetHeight })
            .run();

        if (blockIdRows.length === 0) {
            throw new Error("Corrupt database");
        }

        this.logger.info(`Removing the latest ${AppUtils.pluralise("block", blockIdRows.length, true)}`, "🗑️");

        await this.deleteFromDatabase(targetHeight, targetRound);
    }

    protected async deleteFromDatabase(targetHeight: number, targetRound: number): Promise<void> {
        await this.queryRunner.transaction(
            [
                ...(
                    await this.queryRunner.query(
                        "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'transactions_%' AND name NOT LIKE '%_fts%'",
                    )
                ).map(({ name }) => {
                    return this.createQueryBuilder()
                        .delete()
                        .from(name)
                        .where(
                            "transactions_row IN (SELECT row FROM transactions WHERE block_height > :targetHeight)",
                            { targetHeight },
                        )
                        .getQuery();
                }),
                this.createQueryBuilder()
                    .delete()
                    .from("balance_changes")
                    .where("transactions_row IN (SELECT row FROM transactions WHERE block_height > :targetHeight)", {
                        targetHeight,
                    })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("identities")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("public_keys")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("tokens")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("types")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("transactions")
                    .where("block_height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("blocks")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("missed_blocks")
                    .where("height > :targetHeight", { targetHeight })
                    .getQuery(),
                this.createQueryBuilder()
                    .delete()
                    .from("rounds")
                    .where("round > :targetRound", { targetRound })
                    .getQuery(),
            ],
            false,
        );
    }

    protected getFullQueryBuilder(): Contracts.Database.QueryBuilder {
        return this.createQueryBuilder()
            .select("blocks.*")
            .select(
                "(SELECT public_key FROM public_keys WHERE public_keys.id = blocks.public_key_id)",
                "generatorPublicKey",
            )
            .select("number_of_transactions", "numberOfTransactions")
            .select("payload_hash", "payloadHash")
            .select("payload_length", "payloadLength")
            .select(
                "(SELECT id FROM blocks previousBlocks WHERE previousBlocks.height = blocks.height - 1 LIMIT 1)",
                "previousBlock",
            )
            .select("signature")
            .select("total_amount", "totalAmount")
            .select("total_fee", "totalFee")
            .select(
                "(SELECT COALESCE(SUM(BURN(block_height, fee)), 0) FROM transactions WHERE transactions.block_height = blocks.height)",
                "totalFeeBurned",
            )
            .select(
                "(SELECT identity FROM identities WHERE identities.id = blocks.identity_id AND identities.is_username = 1 LIMIT 1)",
                "username",
            )
            .from("blocks");
    }

    private async findByHeightRangeWithTransactionsRaw(
        start: number,
        end: number,
        serialised: boolean,
    ): Promise<Contracts.Shared.DownloadBlock[] | Interfaces.IBlockData[]> {
        const query = this.createQueryBuilder()
            .select("blocks.*")
            .select("generator_public_key", "generatorPublicKey")
            .select("number_of_transactions", "numberOfTransactions")
            .select("payload_hash", "payloadHash")
            .select("payload_length", "payloadLength")
            .select(
                "(SELECT id FROM blocks previousBlocks WHERE previousBlocks.height = blocks.height - 1 LIMIT 1)",
                "previousBlock",
            )
            .select("signature")
            .select("total_amount", "totalAmount")
            .select("total_fee", "totalFee")
            .select("GROUP_CONCAT(LOWER(HEX(transaction_serialised)))", "transactions")
            .select(
                "CAST((SELECT identity FROM identities WHERE identity_id = identities.id AND is_username = 1 LIMIT 1) AS TEXT)",
                "username",
            )
            .from(
                `(
                    SELECT *,
                    CAST(identity AS TEXT) username,
                    public_key generator_public_key
                    FROM blocks
                    LEFT JOIN (
                        (
                            SELECT block_height transaction_block_height,
                            sequence transaction_sequence,
                            serialised transaction_serialised
                            FROM transactions
                        )
                    )
                    transactions
                    ON transactions.transaction_block_height = blocks.height
                    LEFT JOIN public_keys
                    ON public_keys.id = blocks.public_key_id
                    LEFT JOIN identities
                    ON identities.id = blocks.identity_id
                    WHERE blocks.height BETWEEN ${+start} AND ${+end}
                    ORDER BY blocks.height ASC, transactions.transaction_sequence ASC
                )`,
                "blocks",
            )
            .groupBy("id")
            .orderBy("height", "ASC");

        return (await query.run()).map((block) => {
            for (const [key, value] of Object.entries(block)) {
                if (Buffer.isBuffer(value)) {
                    block[key] = value.toString("hex");
                }
            }
            const transactions: string[] = block.transactions.split(",");
            block.transactions = [];
            for (const transaction of transactions) {
                if (transaction) {
                    block.transactions.push(
                        serialised
                            ? transaction
                            : Transactions.TransactionFactory.fromBytesUnsafe(Buffer.from(transaction, "hex")).data,
                    );
                }
            }
            return block;
        });
    }

    private populate(
        blockHeight: number,
        transaction: Interfaces.ITransaction,
        identities: Map<string, number>,
        publicKeys: Map<string, number>,
        metadata: Map<string, object>,
    ) {
        if (transaction.data.asset?.burn) {
            metadata.set(transaction.data.id!, {
                type: "balanceChange",
                array: [
                    {
                        amountReceived: 0,
                        amountSent: transaction.data.asset.burn.amount,
                    },
                ],
            });
        } else if (transaction.data.asset?.signature) {
            if (
                !publicKeys.has(transaction.data.asset.signature.publicKey) ||
                publicKeys.get(transaction.data.asset.signature.publicKey)! > blockHeight
            ) {
                publicKeys.set(transaction.data.asset.signature.publicKey, blockHeight);
            }
            metadata.set(transaction.data.id!, {
                type: "extraSignature",
                array: [{ publicKey: transaction.data.asset.signature.publicKey }],
            });
        } else if (transaction.data.asset?.ipfs) {
            metadata.set(transaction.data.id!, {
                type: "ipfs",
                array: [{ hash: transaction.data.asset.ipfs.hash }],
            });
        } else if (transaction.data.asset?.registration) {
            if (
                !identities.has(transaction.data.asset.registration.username) ||
                identities.get(transaction.data.asset.registration.username)! > blockHeight
            ) {
                identities.set(transaction.data.asset.registration.username, blockHeight);
            }
            metadata.set(transaction.data.id!, {
                type: "registration",
                array: [{ identity: transaction.data.asset.registration.username }],
            });
        } else if (transaction.data.asset?.resignation) {
            metadata.set(transaction.data.id!, {
                type: "resignation",
                array: [{ resignationType: transaction.data.asset.resignation.type }],
            });
        } else if (transaction.data.asset?.recipients) {
            const recipientArray: Record<string, string | Utils.BigNumber>[] = [];
            let amountSent: Utils.BigNumber = Utils.BigNumber.ZERO;
            for (const { amount: amountReceived, recipientId: identity } of transaction.data.asset.recipients) {
                amountSent = amountSent.plus(amountReceived);
                recipientArray.push({ amountReceived, identity });
                if (!identities.has(identity) || identities.get(identity)! > blockHeight) {
                    identities.set(identity, blockHeight);
                }
            }
            metadata.set(transaction.data.id!, {
                type: "balanceChange",
                array: recipientArray.map((array) => {
                    const { amountReceived, identity } = array;
                    return { amountReceived, amountSent, identity };
                }),
            });
        } else if (transaction.data.asset?.votes) {
            const voteArray: Record<string, string | number>[] = [];
            for (const [identity, percent] of Object.entries(transaction.data.asset.votes)) {
                if (identity.length === 66) {
                    voteArray.push({ percent, publicKeyIdentity: identity });
                } else {
                    voteArray.push({ percent, identity });
                }
            }
            metadata.set(transaction.data.id!, {
                type: "vote",
                array: voteArray,
            });
        }
    }

    private async processBlocksAndTransactionsToSave(
        blocks: Interfaces.IBlock[],
        rawBlocks: Record<string, any>[],
        rawTransactions: Record<string, any>[],
        identities: Map<string, number>,
        publicKeys: Map<string, number>,
        types: Map<string, number>,
        metadata: Map<string, object>,
    ): Promise<number> {
        const blockCount = (await this.createQueryBuilder().select("COUNT()", "count").from("blocks").run())[0].count;

        const lastBlock: Interfaces.IBlockData = (await this.findByHeight(blockCount))!;
        let currentHeight: number = lastBlock?.height ?? 0;
        let previousId: string | undefined = lastBlock?.id ?? "0".repeat(64);

        let highestHeight: number = 0;

        for (const block of blocks) {
            currentHeight++;
            if (block.data.height !== currentHeight || block.data.previousBlock !== previousId) {
                throw new Error(
                    `Block ${block.data.height.toLocaleString()} is not chained to the last block in the database at height ${currentHeight.toLocaleString()}`,
                );
            }
            previousId = block.data.id!;
            highestHeight = block.data.height;
            const rawBlock = BlockModel.from(Object.assign(new BlockModel(), { ...block.data }));

            if (
                !publicKeys.has(block.data.generatorPublicKey) ||
                publicKeys.get(block.data.generatorPublicKey)! > block.data.height
            ) {
                publicKeys.set(block.data.generatorPublicKey, block.data.height);
            }

            if (block.transactions.length > 0) {
                const transactions: Record<string, any>[] = [];
                for (const transaction of block.transactions) {
                    const blockHeight: number = transaction.data.blockHeight!;
                    const rawTransaction = TransactionModel.from(
                        Object.assign(new TransactionModel(), {
                            ...transaction.data,
                            serialised: transaction.serialised!,
                            timestamp: transaction.data.timestamp!,
                        }),
                    );
                    if (
                        !identities.has(transaction.data.senderId) ||
                        identities.get(transaction.data.senderId)! > blockHeight
                    ) {
                        identities.set(transaction.data.senderId, blockHeight);
                    }
                    if (
                        !publicKeys.has(transaction.data.senderPublicKey) ||
                        publicKeys.get(transaction.data.senderPublicKey)! > blockHeight
                    ) {
                        publicKeys.set(transaction.data.senderPublicKey, blockHeight);
                    }
                    if (!types.has(transaction.data.type) || types.get(transaction.data.type)! > blockHeight) {
                        types.set(transaction.data.type, blockHeight);
                    }

                    this.populate(blockHeight, transaction, identities, publicKeys, metadata);

                    transactions.push(rawTransaction);
                }
                transactions.sort((a, b) => {
                    return a.sequence - b.sequence;
                });
                rawTransactions.push(...transactions);
            }

            rawBlocks.push(rawBlock);
        }

        return highestHeight;
    }

    private processMissedBlocksToSave(
        missedBlocks: { timestamp: number; height: number; username: string }[],
        rawMissedBlocks: Record<string, any>[],
        identities: Map<string, number>,
    ): void {
        for (const { height, timestamp, username } of missedBlocks) {
            if (!identities.has(username) || identities.get(username)! > height) {
                identities.set(username, height);
            }
            rawMissedBlocks.push(
                MissedBlockModel.from({
                    height,
                    timestamp,
                    username,
                }),
            );
        }
    }

    private processRoundsToSave(
        rounds: Record<number, { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]>,
        rawRounds: Record<string, any>[],
        publicKeys: Map<string, number>,
        highestHeight: number,
    ): void {
        for (const [height, roundData] of Object.entries(rounds)) {
            if (+height <= highestHeight) {
                for (const { balance, publicKey, round, username } of roundData) {
                    if (!publicKeys.has(publicKey) || publicKeys.get(publicKey)! > +height) {
                        publicKeys.set(publicKey, +height);
                    }
                    rawRounds.push(
                        RoundModel.from({
                            balance,
                            publicKey,
                            round,
                            username,
                        }),
                    );
                }
            }
        }
    }

    private saveBlocks(rawBlocks: Record<string, any>[]): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const block of rawBlocks) {
            const queryBuilder: Contracts.Database.QueryBuilder = this.createQueryBuilder();
            for (const [key, value] of Object.entries(block)) {
                if (key !== "foreignKeys") {
                    const snakeKey: string = AppUtils.snakeCase(key)!;
                    queryBuilder.insert(snakeKey!, { [snakeKey]: value });
                }
            }

            if (block.foreignKeys.username) {
                queryBuilder.insertSubquery(
                    "identity_id",
                    "(SELECT id FROM identities WHERE identity = :username AND is_username = 1 LIMIT 1)",
                    { username: block.foreignKeys.username },
                );
            }

            queryBuilder
                .insertSubquery(
                    "public_key_id",
                    "(SELECT id FROM public_keys WHERE public_key = :generatorPublicKey)",
                    { generatorPublicKey: block.foreignKeys.generatorPublicKey },
                )
                .insertSubquery(
                    "previous_block_height",
                    "(SELECT height FROM blocks WHERE id = :previousBlock LIMIT 1)",
                    {
                        previousBlock: block.foreignKeys.previousBlock,
                    },
                )
                .into("blocks");
            queries.push(queryBuilder.getQuery());
        }

        return queries;
    }

    private saveIdentities(identities: Map<string, number>): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const [identity, height] of identities.entries()) {
            queries.push(
                this.createQueryBuilder()
                    .insert("identity", { identity })
                    .insert("height", { height })
                    .insert("is_username", { isUsername: identity.length <= 20 })
                    .insertSubquery("id", "(SELECT MAX(id) + 1 FROM identities)")
                    .ignore()
                    .into("identities")
                    .getQuery(),
            );
        }

        return queries;
    }

    private saveMetadata(
        metadata: Map<
            string,
            {
                array: Record<string, string | number | Utils.BigNumber | object>[];
                total?: Utils.BigNumber;
                type: string;
            }
        >,
    ): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const [id, data] of metadata.entries()) {
            for (const element of data.array) {
                const queryBuilder = this.createQueryBuilder();
                for (const [key, value] of Object.entries(element)) {
                    switch (key) {
                        case "identity": {
                            queryBuilder.insertSubquery(
                                "identity_id",
                                "(SELECT id FROM identities WHERE identity = :identity LIMIT 1)",
                                {
                                    identity: value,
                                },
                            );
                            break;
                        }
                        case "publicKey": {
                            queryBuilder.insertSubquery(
                                "public_key_id",
                                "(SELECT id FROM public_keys WHERE public_key = :publicKey LIMIT 1)",
                                {
                                    publicKey: value,
                                },
                            );
                            break;
                        }
                        case "publicKeyIdentity": {
                            queryBuilder.insertSubquery(
                                "identity_id",
                                `(SELECT identity_id FROM transactions_registration WHERE transactions_row = (
                                    SELECT row FROM transactions WHERE public_key_id = (
                                        SELECT id FROM public_keys WHERE public_key = :publicKey LIMIT 1
                                    ) ORDER BY block_height ASC LIMIT 1
                                ) LIMIT 1)`,
                                {
                                    publicKey: value,
                                },
                            );
                            break;
                        }
                        default:
                            queryBuilder.insert(AppUtils.snakeCase(key)!, { [key]: value });
                    }
                }
                queryBuilder
                    .insertSubquery("transactions_row", "(SELECT row FROM transactions WHERE id = :id LIMIT 1)", { id })
                    .into(
                        data.type === "balanceChange"
                            ? AppUtils.snakeCase(data.type) + "s"
                            : `transactions_${AppUtils.snakeCase(data.type)}`,
                    )
                    .ignore();
                queries.push(queryBuilder.getQuery());
            }
        }

        return queries;
    }

    private saveMissedBlocks(rawMissedBlocks: Record<string, any>[]): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const missedBlock of rawMissedBlocks) {
            const queryBuilder: Contracts.Database.QueryBuilder = this.createQueryBuilder();
            for (const [key, value] of Object.entries(missedBlock)) {
                if (key !== "foreignKeys" && value !== undefined) {
                    const snakeKey: string = AppUtils.snakeCase(key)!;
                    queryBuilder.insert(snakeKey!, { [snakeKey]: value });
                }
            }
            queryBuilder
                .insertSubquery("identity_id", "(SELECT id FROM identities WHERE identity = :identity LIMIT 1)", {
                    identity: missedBlock.foreignKeys.username,
                })
                .into("missed_blocks");
            queries.push(queryBuilder.getQuery());
        }

        return queries;
    }

    private savePublicKeys(publicKeys: Map<string, number>): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const [publicKey, height] of publicKeys.entries()) {
            queries.push(
                this.createQueryBuilder()
                    .insert("height", { height })
                    .insert("public_key", { publicKey })
                    .insertSubquery("id", "(SELECT MAX(id) + 1 FROM public_keys)")
                    .ignore()
                    .into("public_keys")
                    .getQuery(),
            );
        }

        return queries;
    }

    private saveRounds(rawRounds: Record<string, any>[]): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        if (rawRounds.length > 0) {
            queries.push(
                this.createQueryBuilder()
                    .delete()
                    .from("rounds")
                    .where("round >= :targetRound", { targetRound: rawRounds[0].round })
                    .getQuery(),
            );
        }

        for (const round of rawRounds) {
            const queryBuilder: Contracts.Database.QueryBuilder = this.createQueryBuilder();
            for (const [key, value] of Object.entries(round)) {
                if (key !== "foreignKeys") {
                    const snakeKey: string = AppUtils.snakeCase(key)!;
                    queryBuilder.insert(snakeKey!, { [snakeKey]: value });
                }
            }
            queryBuilder
                .insertSubquery("public_key_id", "(SELECT id FROM public_keys WHERE public_key = :publicKey LIMIT 1)", {
                    publicKey: round.foreignKeys.publicKey,
                })
                .insertSubquery("identity_id", "(SELECT id FROM identities WHERE identity = :identity LIMIT 1)", {
                    identity: round.foreignKeys.username,
                })
                .into("rounds");
            queries.push(queryBuilder.getQuery());
        }

        return queries;
    }

    private saveTransactions(rawTransactions: Record<string, any>[]): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const transaction of rawTransactions) {
            const queryBuilder: Contracts.Database.QueryBuilder = this.createQueryBuilder();
            for (const [key, value] of Object.entries(transaction)) {
                if (key !== "foreignKeys" && value !== undefined) {
                    const snakeKey: string = AppUtils.snakeCase(key)!;
                    queryBuilder.insert(snakeKey!, { [snakeKey]: value });
                }
            }
            queryBuilder
                .insertSubquery("row", "(SELECT MAX(row) + 1 FROM transactions)")
                .insertSubquery(
                    "public_key_id",
                    "(SELECT id FROM public_keys WHERE public_key = :senderPublicKey LIMIT 1)",
                    {
                        senderPublicKey: transaction.foreignKeys.senderPublicKey,
                    },
                )
                .insertSubquery("identity_id", "(SELECT id FROM identities WHERE identity = :senderId LIMIT 1)", {
                    senderId: transaction.foreignKeys.senderId,
                })
                .insertSubquery("type_id", "(SELECT id FROM types WHERE type = :type LIMIT 1)", {
                    type: transaction.foreignKeys.type,
                })
                .into("transactions");
            queries.push(queryBuilder.getQuery());
        }

        return queries;
    }

    private saveTypes(types: Map<string, number>): Contracts.Database.DatabaseTransaction[] {
        const queries: Contracts.Database.DatabaseTransaction[] = [];

        for (const [type, height] of types.entries()) {
            queries.push(
                this.createQueryBuilder()
                    .insert("height", { height })
                    .insert("type", { type })
                    .insertSubquery("id", "(SELECT MAX(id) + 1 FROM types)")
                    .ignore()
                    .into("types")
                    .getQuery(),
            );
        }

        return queries;
    }
}

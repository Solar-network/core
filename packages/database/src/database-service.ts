import { Blocks, Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { RoundModel } from "./models";
import { BlockRepository, RoundRepository, TransactionRepository } from "./repositories";

@Container.injectable()
export class DatabaseService {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: TransactionRepository;

    @Container.inject(Container.Identifiers.DatabaseRoundRepository)
    private readonly roundRepository!: RoundRepository;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "database")
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.DatabaseQueryRunner)
    private readonly queryRunner!: Contracts.Database.QueryRunner;

    private roundState!: Contracts.State.RoundState;

    public checkpoint(): void {
        this.queryRunner.checkpoint();
    }

    public async getBlock(id: string): Promise<Interfaces.IBlock | undefined> {
        // TODO: caching the last 1000 blocks, in combination with `saveBlock` could help to optimise
        const block: Interfaces.IBlockData = (await this.blockRepository.findBlockById(id)) as Interfaces.IBlockData;

        if (!block) {
            return undefined;
        }

        const transactions: Array<{
            serialised: Buffer;
            id: string;
        }> = await this.transactionRepository.findByBlockHeights([block.height]);

        block.transactions = transactions.map(
            ({ serialised, id }) => Transactions.TransactionFactory.fromBytesUnsafe(serialised, id).data,
        );

        return Blocks.BlockFactory.fromData(block, {
            deserialiseTransactionsUnchecked: true,
        });
    }

    public async getBlocks(start: number, end: number, headersOnly?: boolean): Promise<Interfaces.IBlockData[]> {
        return headersOnly
            ? await this.blockRepository.findByHeightRange(start, end)
            : await this.blockRepository.findByHeightRangeWithTransactions(start, end);
    }

    public async getBlocksForDownload(
        offset: number,
        limit: number,
        headersOnly?: boolean,
    ): Promise<Contracts.Shared.DownloadBlock[]> {
        if (headersOnly) {
            return this.blockRepository.findByHeightRange(offset, offset + limit - 1) as unknown as Promise<
                Contracts.Shared.DownloadBlock[]
            >;
        }

        return this.blockRepository.findByHeightRangeWithTransactionsForDownload(
            offset,
            offset + limit - 1,
        ) as unknown as Promise<Contracts.Shared.DownloadBlock[]>;
    }

    public async findBlockByHeights(heights: number[]): Promise<Contracts.Database.BlockModel[]> {
        return await this.blockRepository.findByHeights(heights);
    }

    public async getLastBlock(): Promise<Interfaces.IBlock> {
        const block: Interfaces.IBlockData | undefined = await this.blockRepository.findLatest();
        if (!block) {
            return undefined as unknown as Interfaces.IBlock;
        }

        const transactions: Array<{
            id: string;
            blockHeight: number;
            serialised: Buffer;
        }> = await this.transactionRepository.findByBlockHeights([block.height]);

        block.transactions = transactions.map(
            ({ serialised, id }) => Transactions.TransactionFactory.fromBytesUnsafe(serialised, id).data,
        );

        const lastBlock: Interfaces.IBlock = Blocks.BlockFactory.fromData(block, {
            deserialiseTransactionsUnchecked: true,
        })!;

        return lastBlock;
    }

    public async getTopBlocks(count: number): Promise<Interfaces.IBlockData[]> {
        const blocks: Interfaces.IBlockData[] = (await this.blockRepository.findTop(count)) as Interfaces.IBlockData[];

        await this.loadTransactionsForBlocks(blocks);

        return blocks;
    }

    public async getTransaction(id: string): Promise<Contracts.Database.TransactionModel | undefined> {
        const transaction = await this.transactionRepository.findTransactionById(id);
        if (transaction) {
            return transaction;
        }

        return undefined;
    }

    public async delete(blocks: Interfaces.IBlockData[]): Promise<void> {
        return await this.blockRepository.delete(blocks);
    }

    public async save(blocks: Interfaces.IBlock[]): Promise<void> {
        if (!this.roundState) {
            this.roundState = this.app.get<Contracts.State.RoundState>(Container.Identifiers.RoundState);
        }
        return await this.blockRepository.save(
            blocks,
            this.roundState.getBlockProductionFailuresToSave(),
            this.roundState.getRoundsToSave(),
            this.events,
        );
    }

    public async findLatestBlock(): Promise<Interfaces.IBlockData | undefined> {
        return await this.blockRepository.findLatest();
    }

    public async findBlocksById(ids: string[]): Promise<Interfaces.IBlockData[] | undefined> {
        return (await this.blockRepository.findBlocksById(ids)) as Interfaces.IBlockData[];
    }

    public async getRound(round: number): Promise<RoundModel[]> {
        return await this.roundRepository.getRound(round);
    }

    public async verifyBlockchain(lastBlock?: Interfaces.IBlock): Promise<boolean> {
        const errors: string[] = [];

        const block: Interfaces.IBlock = lastBlock ? lastBlock : await this.getLastBlock();

        const blockStats: {
            numberOfTransactions: number;
            totalFee: string;
            count: number;
        } = await this.blockRepository.getStatistics();

        if (!block) {
            errors.push("Last block is not available");
        } else {
            const numberOfBlocks: number = blockStats.count;

            if (block.data.height !== +numberOfBlocks) {
                errors.push(
                    `Last block height: ${block.data.height.toLocaleString()}, number of stored blocks: ${numberOfBlocks.toLocaleString()}`,
                );
            }
        }

        const transactionStats: {
            count: number;
            totalFee: string;
        } = await this.transactionRepository.getStatistics();

        // Number of stored transactions equals the sum of block.numberOfTransactions in the database
        if (blockStats.numberOfTransactions !== transactionStats.count) {
            errors.push(
                `Number of transactions: ${transactionStats.count}, number of transactions included in blocks: ${blockStats.numberOfTransactions}`,
            );
        }

        // Sum of all tx fees equals the sum of block.totalFee
        if (blockStats.totalFee !== transactionStats.totalFee) {
            errors.push(
                `Total transaction fees: ${transactionStats.totalFee}, total of block.totalFee : ${blockStats.totalFee}`,
            );
        }

        const hasErrors: boolean = errors.length > 0;

        if (hasErrors) {
            this.logger.error("The database is corrupted");
            this.logger.error(JSON.stringify(errors, undefined, 4));
        }

        return !hasErrors;
    }

    private async loadTransactionsForBlocks(blocks: Interfaces.IBlockData[]): Promise<void> {
        const dbTransactions: Array<{
            id: string;
            blockHeight: number;
            serialised: Buffer;
        }> = await this.getTransactionsForBlocks(blocks);

        const transactions = dbTransactions.map((tx) => {
            const { data } = Transactions.TransactionFactory.fromBytesUnsafe(tx.serialised, tx.id);
            return data;
        });

        for (const block of blocks) {
            if (block.numberOfTransactions > 0) {
                block.transactions = transactions.filter((transaction) => transaction.blockHeight === block.height);
            }
        }
    }

    private async getTransactionsForBlocks(blocks: Interfaces.IBlockData[]): Promise<
        Array<{
            id: string;
            blockHeight: number;
            serialised: Buffer;
        }>
    > {
        if (!blocks.length) {
            return [];
        }

        const heights: number[] = blocks.map((block: Interfaces.IBlockData) => block.height!);
        return this.transactionRepository.findByBlockHeights(heights);
    }
}

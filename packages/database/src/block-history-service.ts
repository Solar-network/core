import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import assert from "assert";

import { BlockRepository, TransactionRepository } from "./repositories";

@Container.injectable()
export class BlockHistoryService implements Contracts.Shared.BlockHistoryService {
    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: TransactionRepository;

    @Container.inject(Container.Identifiers.DatabaseBlockFilter)
    private readonly blockFilter!: Contracts.Database.BlockFilter;

    @Container.inject(Container.Identifiers.DatabaseTransactionFilter)
    private readonly transactionFilter!: Contracts.Database.TransactionFilter;

    @Container.inject(Container.Identifiers.DatabaseModelConverter)
    private readonly modelConverter!: Contracts.Database.ModelConverter;

    public async findOneByCriteria(
        criteria: Contracts.Shared.OrBlockCriteria,
    ): Promise<Interfaces.IBlockData | undefined> {
        const data = await this.findManyByCriteria(criteria);
        assert(data.length <= 1);
        return data[0];
    }

    public async findManyByCriteria(criteria: Contracts.Shared.OrBlockCriteria): Promise<Interfaces.IBlockData[]> {
        const expression = await this.blockFilter.getExpression(criteria);
        const sorting: Contracts.Search.Sorting = [{ property: "height", direction: "asc" }];
        const models = await this.blockRepository.findManyByExpression(expression, sorting);
        return this.modelConverter.getBlockData(models);
    }

    public async getBlocksLike(criteria: string | number): Promise<Contracts.Shared.BlockSearchResource[]> {
        let criteriaObject: { id?: string; height?: number };
        if (typeof criteria === "string") {
            criteriaObject = { id: criteria.toLowerCase() };
        } else {
            criteriaObject = { height: criteria };
        }

        return (
            await this.listByCriteria(criteriaObject, [{ property: "id", direction: "asc" }], {
                offset: 0,
                limit: 100,
            })
        ).results.map((block: Interfaces.IBlockData) => ({
            height: block.height,
            id: block.id,
            timestamp: block.timestamp,
            transactions: block.numberOfTransactions,
            username: block.username,
        }));
    }

    public async listByCriteria(
        criteria: Contracts.Shared.OrBlockCriteria,
        sorting: Contracts.Search.Sorting,
        pagination: Contracts.Search.Pagination,
        count: boolean = true,
    ): Promise<Contracts.Search.ResultsPage<Interfaces.IBlockData>> {
        const expression = await this.blockFilter.getExpression(criteria);
        const modelResultsPage = await this.blockRepository.listByExpression(expression, sorting, pagination, count);
        const models = modelResultsPage.results;
        const data = this.modelConverter.getBlockData(models);
        return { ...modelResultsPage, results: data };
    }

    public async findOneByCriteriaJoinTransactions(
        blockCriteria: Contracts.Shared.OrBlockCriteria,
        transactionCriteria: Contracts.Shared.OrTransactionCriteria,
    ): Promise<Contracts.Shared.BlockDataWithTransactionData | undefined> {
        const data = await this.findManyByCriteriaJoinTransactions(blockCriteria, transactionCriteria);
        return data[0];
    }

    public async findManyByCriteriaJoinTransactions(
        blockCriteria: Contracts.Shared.OrBlockCriteria,
        transactionCriteria: Contracts.Shared.OrTransactionCriteria,
    ): Promise<Contracts.Shared.BlockDataWithTransactionData[]> {
        const blockExpression = await this.blockFilter.getExpression(blockCriteria);
        const blockModels = await this.blockRepository.findManyByExpression(blockExpression);

        const transactionBlockCriteria = blockModels.map((b) => ({ blockHeight: b.height }));
        const transactionExpression = await this.transactionFilter.getExpression(
            transactionCriteria,
            transactionBlockCriteria,
        );
        const transactionModels = await this.transactionRepository.findManyByExpression(transactionExpression);
        const blockDataWithTransactionData = this.modelConverter.getBlockDataWithTransactionData(
            blockModels,
            transactionModels,
        );

        return blockDataWithTransactionData;
    }

    public async listByCriteriaJoinTransactions(
        blockCriteria: Contracts.Search.OrCriteria<Contracts.Shared.BlockCriteria>,
        transactionCriteria: Contracts.Search.OrCriteria<Contracts.Shared.TransactionCriteria>,
        sorting: Contracts.Search.Sorting,
        pagination: Contracts.Search.Pagination,
        count: boolean = true,
    ): Promise<Contracts.Search.ResultsPage<Contracts.Shared.BlockDataWithTransactionData>> {
        const blockExpression = await this.blockFilter.getExpression(blockCriteria);
        const blockModelResultsPage = await this.blockRepository.listByExpression(
            blockExpression,
            sorting,
            pagination,
            count,
        );
        const blockModels = blockModelResultsPage.results;

        const transactionBlockCriteria = blockModels.map((b) => ({ blockHeight: b.height }));
        const transactionExpression = await this.transactionFilter.getExpression(
            transactionCriteria,
            transactionBlockCriteria,
        );
        const transactionModels = await this.transactionRepository.findManyByExpression(transactionExpression);
        const blockDataWithTransactionData = this.modelConverter.getBlockDataWithTransactionData(
            blockModels,
            transactionModels,
        );

        return { ...blockModelResultsPage, results: blockDataWithTransactionData };
    }
}

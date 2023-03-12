import { Interfaces, Utils } from "@solar-network/crypto";

import { Search } from "../";
import { EventDispatcher } from "../kernel";
import { DownloadBlock } from "../shared";
import { BlockModel, Model, RoundModel, TransactionModel } from "./models";

export interface Repository {
    createQueryBuilder(): void;
    findManyByExpression(expression: Search.Expression<Model>, sorting: Search.Sorting): Promise<Model[]>;
    listByExpression(
        expression: Search.Expression<Model>,
        sorting: Search.Sorting,
        pagination: Search.Pagination,
        count: boolean,
    ): Promise<Search.ResultsPage<Model>>;
}

export interface BlockRepository extends Repository {
    calculateDonations(): Promise<{ address: string; amount: Utils.BigNumber; username: string }[]>;
    findBlocksById(ids: string[]): Promise<BlockModel[]>;
    findBlockById(id: string): Promise<BlockModel>;
    findLatest(): Promise<Interfaces.IBlockData | undefined>;
    findTop(limit: number): Promise<BlockModel[]>;
    findByHeight(height: number): Promise<BlockModel | undefined>;
    findByHeights(heights: number[]): Promise<BlockModel[]>;
    findByHeightRange(start: number, end: number): Promise<BlockModel[]>;
    findByHeightRangeWithTransactionsForDownload(start: number, end: number): Promise<DownloadBlock[]>;
    findByHeightRangeWithTransactions(start: number, end: number): Promise<Interfaces.IBlockData[]>;
    getStatistics(): Promise<{ numberOfTransactions: number; totalFee: string; count: number }>;
    getBlockRewards(): Promise<{ username: string; rewards: string }[]>;
    getBlockProducerStatistics(): Promise<
        {
            username: string;
            height: number;
            totalRewards: string;
            donations: string;
            totalFees: string;
            totalFeesBurned: string;
            totalProduced: number;
        }[]
    >;
    getLastProducedBlocks(): Promise<Interfaces.IBlockData[]>;
    save(
        blocks: Interfaces.IBlock[],
        blockProductionFailures: { timestamp: number; height: number; username: string }[],
        rounds: Record<number, { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]>,
        events: EventDispatcher,
    ): Promise<void>;
    delete(blocks: Interfaces.IBlockData[]): Promise<void>;
    deleteTop(count: number): Promise<void>;
}

export interface MigrationRepository extends Repository {
    performMigrations(): Promise<void>;
}

export interface BlockProductionFailureRepository extends Repository {
    getReliability(timestamp: number): Promise<Record<string, Record<string, number>>>;
    hasBlockProductionFailures(): Promise<boolean>;
}

export interface RoundRepository extends Repository {
    getLastRound(): Promise<RoundModel[]>;
    getRound(round: number): Promise<RoundModel[]>;
}

export interface TransactionRepository extends Repository {
    fetchByExpression(
        expression: Search.Expression<TransactionModel>,
        sorting: Search.Sorting,
    ): AsyncIterable<TransactionModel>;
    findTransactionsById(ids: string[]): Promise<TransactionModel[]>;
    findTransactionById(id: string): Promise<TransactionModel>;
    findByBlockHeights(blockHeights: number[]): Promise<Array<{ id: string; blockHeight: number; serialised: Buffer }>>;
    getConfirmedTransactionIds(ids: string[]): Promise<string[]>;
    getStatistics(): Promise<{ count: number; totalFee: string }>;
    getFeeStatistics(txTypes: Array<{ type: string }>, days?: number, minFee?: number): Promise<FeeStatistics[]>;
    getFeesBurned(): Promise<string>;
    getBurnTransactionTotal(): Promise<string>;
    getPreviousReceivedTransactionOfType(
        data: Interfaces.ITransactionData,
        recipientId: string,
        offset?: number,
    ): Promise<Interfaces.ITransactionData | undefined>;
    getPreviousSentTransactionOfType(
        data: Interfaces.ITransactionData,
        offset?: number,
    ): Promise<Interfaces.ITransactionData | undefined>;
    getSentTransactions(): Promise<{ senderId: string; fee: string; nonce: string }[]>;
}

export type FeeStatistics = {
    type: string;
    burned: number;
    avg: number;
    min: number;
    max: number;
    sum: number;
};

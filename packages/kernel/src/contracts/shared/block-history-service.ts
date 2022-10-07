import { Interfaces, Utils } from "@solar-network/crypto";

import {
    OrCriteria,
    OrEqualCriteria,
    OrLikeCriteria,
    OrNumericCriteria,
    Pagination,
    ResultsPage,
    Sorting,
} from "../search";
import { OrTransactionCriteria } from "./transaction-history-service";

export type BlockCriteria = {
    id?: OrLikeCriteria<string>;
    version?: OrEqualCriteria<number>;
    timestamp?: OrNumericCriteria<number>;
    previousBlock?: OrEqualCriteria<string>;
    height?: OrNumericCriteria<number>;
    numberOfTransactions?: OrNumericCriteria<number>;
    totalAmount?: OrNumericCriteria<Utils.BigNumber>;
    totalFee?: OrNumericCriteria<Utils.BigNumber>;
    totalFeeBurned?: OrNumericCriteria<Utils.BigNumber>;
    reward?: OrNumericCriteria<Utils.BigNumber>;
    payloadLength?: OrNumericCriteria<number>;
    payloadHash?: OrEqualCriteria<string>;
    generatorPublicKey?: OrEqualCriteria<string>;
    username?: OrEqualCriteria<string>;
    signature?: OrEqualCriteria<string>;
};

export type BlockSearchResource = {
    height: number;
    id?: string;
    timestamp: number;
    transactions: number;
    username?: string;
};

export type OrBlockCriteria = OrCriteria<BlockCriteria>;

export type BlockDataWithTransactionData = {
    data: Interfaces.IBlockData;
    transactions: Interfaces.ITransactionData[];
};

export interface BlockHistoryService {
    getBlocksLike(criteria: string): Promise<BlockSearchResource[]>;

    findOneByCriteria(criteria: OrBlockCriteria): Promise<Interfaces.IBlockData | undefined>;

    findManyByCriteria(criteria: OrBlockCriteria): Promise<Interfaces.IBlockData[]>;

    listByCriteria(
        criteria: OrBlockCriteria,
        sorting: Sorting,
        pagination: Pagination,
        count?: boolean,
    ): Promise<ResultsPage<Interfaces.IBlockData>>;

    findOneByCriteriaJoinTransactions(
        blockCriteria: OrBlockCriteria,
        transactionCriteria: OrTransactionCriteria,
    ): Promise<BlockDataWithTransactionData | undefined>;

    findManyByCriteriaJoinTransactions(
        blockCriteria: OrBlockCriteria,
        transactionCriteria: OrTransactionCriteria,
    ): Promise<BlockDataWithTransactionData[]>;

    listByCriteriaJoinTransactions(
        blockCriteria: OrBlockCriteria,
        transactionCriteria: OrTransactionCriteria,
        sorting: Sorting,
        pagination: Pagination,
    ): Promise<ResultsPage<BlockDataWithTransactionData>>;
}

import { Interfaces, Utils } from "@solar-network/crypto";

import {
    Options,
    OrContainsCriteria,
    OrCriteria,
    OrEqualCriteria,
    OrLikeCriteria,
    OrNumericCriteria,
    Pagination,
    ResultsPage,
    Sorting,
} from "../search";

export type TransactionCriteria = {
    address?: OrEqualCriteria<string>;
    senderId?: OrEqualCriteria<string>;
    recipientId?: OrEqualCriteria<string>;
    id?: OrLikeCriteria<string>;
    version?: OrEqualCriteria<number>;
    blockHeight?: OrNumericCriteria<number>;
    blockId?: OrEqualCriteria<string>;
    sequence?: OrNumericCriteria<number>;
    timestamp?: OrNumericCriteria<number>;
    nonce?: OrNumericCriteria<Utils.BigNumber>;
    senderPublicKey?: OrEqualCriteria<string>;
    type?: OrEqualCriteria<number>;
    typeGroup?: OrEqualCriteria<number>;
    memo?: OrLikeCriteria<string>;
    amount?: OrNumericCriteria<Utils.BigNumber>;
    burnedFee?: OrNumericCriteria<Utils.BigNumber>;
    fee?: OrNumericCriteria<Utils.BigNumber>;
    asset?: OrContainsCriteria<Record<string, any>>;
};

export type TransactionSearchResource = {
    amount?: Utils.BigNumber;
    asset?: Interfaces.ITransactionAsset;
    id?: string;
    recipient?: string;
    sender: string;
    type: number;
    typeGroup?: number;
};

export type OrTransactionCriteria = OrCriteria<TransactionCriteria>;

export type TransactionDataWithBlockData = {
    data: Interfaces.ITransactionData;
    block: Interfaces.IBlockData;
};

export interface TransactionHistoryService {
    getTransactionsLike(criteria: string): Promise<TransactionSearchResource[]>;

    findOneByCriteria(criteria: OrTransactionCriteria): Promise<Interfaces.ITransactionData | undefined>;

    findManyByCriteria(criteria: OrTransactionCriteria): Promise<Interfaces.ITransactionData[]>;

    streamByCriteria(criteria: OrTransactionCriteria): AsyncIterable<Interfaces.ITransactionData>;

    listByCriteria(
        criteria: OrTransactionCriteria,
        sorting: Sorting,
        pagination: Pagination,
        options?: Options,
    ): Promise<ResultsPage<Interfaces.ITransactionData>>;

    findOneByCriteriaJoinBlock(criteria: OrTransactionCriteria): Promise<TransactionDataWithBlockData | undefined>;

    findManyByCriteriaJoinBlock(criteria: OrTransactionCriteria): Promise<TransactionDataWithBlockData[]>;

    listByCriteriaJoinBlock(
        criteria: OrTransactionCriteria,
        sorting: Sorting,
        pagination: Pagination,
        options?: Options,
    ): Promise<ResultsPage<TransactionDataWithBlockData>>;
}

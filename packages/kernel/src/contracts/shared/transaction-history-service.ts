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

export type TransactionCriteria = {
    address?: OrEqualCriteria<string>;
    senderId?: OrEqualCriteria<string>;
    recipientId?: OrEqualCriteria<string>;
    id?: OrLikeCriteria<string>;
    version?: OrEqualCriteria<number>;
    blockHeight?: OrNumericCriteria<number>;
    sequence?: OrNumericCriteria<number>;
    timestamp?: OrNumericCriteria<number>;
    nonce?: OrNumericCriteria<Utils.BigNumber>;
    senderPublicKey?: OrEqualCriteria<string>;
    type?: OrEqualCriteria<string>;
    memo?: OrLikeCriteria<string>;
    amount?: {
        received?: OrNumericCriteria<Utils.BigNumber>;
        sent?: OrNumericCriteria<Utils.BigNumber>;
    };
    fee?: OrNumericCriteria<Utils.BigNumber>;
    extraSignature?: OrEqualCriteria<number>;
    registration?: OrEqualCriteria<number>;
    vote?: {
        percent?: OrNumericCriteria<Utils.BigNumber>;
        username?: OrEqualCriteria<number>;
    };
    ipfsHash?: OrEqualCriteria<number>;
    resignation?: OrEqualCriteria<number>;
};

export type TransactionSearchResource = {
    amount?: Utils.BigNumber;
    asset?: Interfaces.ITransactionAsset;
    id?: string;
    recipient?: string;
    sender: string;
    type: string;
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

    fetchByCriteria(criteria: OrTransactionCriteria): AsyncIterable<Interfaces.ITransactionData>;

    listByCriteria(
        criteria: OrTransactionCriteria,
        sorting: Sorting,
        pagination: Pagination,
        count?: boolean,
    ): Promise<ResultsPage<Interfaces.ITransactionData>>;

    findOneByCriteriaJoinBlock(criteria: OrTransactionCriteria): Promise<TransactionDataWithBlockData | undefined>;

    findManyByCriteriaJoinBlock(criteria: OrTransactionCriteria): Promise<TransactionDataWithBlockData[]>;

    listByCriteriaJoinBlock(
        criteria: OrTransactionCriteria,
        sorting: Sorting,
        pagination: Pagination,
    ): Promise<ResultsPage<TransactionDataWithBlockData>>;
}

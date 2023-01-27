import { Interfaces } from "@solar-network/crypto";

import { WalletBlockProducerAttributes, WalletData } from "../state";

export interface Response<T> {
    data: T;
}

export interface BlockProducerWallet extends WalletData {
    blockProducer: WalletBlockProducerAttributes;
    username: string;
}

export interface CurrentRound {
    current: number;
    reward: string;
    timestamp: number;
    allBlockProducers: BlockProducerWallet[];
    blockProducers: BlockProducerWallet[];
    currentBlockProducer: BlockProducerWallet;
    nextBlockProducer: BlockProducerWallet;
    lastBlock: Interfaces.IBlockData;
    canProduceBlock: boolean;
}

export interface PoolData {
    transactions: string[];
    poolSize: number;
    count: number;
}

export interface Status {
    state: {
        header: {
            generatorPublicKey: string;
            timestamp: number;
        };
    };
}

export interface UnconfirmedTransactions {
    transactions: Buffer[];
    poolSize: number;
}

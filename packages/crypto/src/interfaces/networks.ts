import { IBlockJson } from "./block";

export interface NetworkConfig {
    exceptions: IExceptions;
    genesisBlock: IBlockJson;
    milestones: Array<Record<string, any>>;
    network: Network;
}

export interface Network {
    name: string;
    messagePrefix: string;
    bip32: {
        public: number;
        private: number;
    };
    pubKeyHash: number;
    nethash: string;
    wif: number;
    slip44: number;
    ticker: string;
}

export interface IExceptions {
    blocks?: string[];
    transactions?: string[];
}

import { ITransactionData } from "../interfaces";
import { BigNumber } from "../utils";
import { ITransaction, ITransactionJson } from "./transactions";

export interface IBlockVerification {
    verified: boolean;
    errors: string[];
    containsMultiSignatures: boolean;
}

export interface IBlock {
    serialized: string;
    data: IBlockData;
    transactions: ITransaction[];
    verification: IBlockVerification;

    getBurnedFees(): BigNumber;
    getHeader(): IBlockData;
    verifySignature(): boolean;
    verify(): IBlockVerification;

    toString(): string;
    toJson(): IBlockJson;
}

export interface IBlockData {
    id?: string;
    timestamp: number;
    version: number;
    height: number;
    previousBlock: string;
    numberOfTransactions: number;
    totalAmount: BigNumber;
    totalFee: BigNumber;
    burnedFee?: BigNumber;
    reward: BigNumber;
    devFund?: Record<string, BigNumber>;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    blockSignature?: string;
    serialized?: string;
    transactions?: ITransactionData[];
    ip?: string;
}

export interface IBlockJson {
    id?: string;
    timestamp: number;
    version: number;
    height: number;
    previousBlock: string;
    numberOfTransactions: number;
    totalAmount: string;
    totalFee: string;
    burnedFee: string;
    reward: string;
    devFund: string;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    blockSignature?: string;
    serialized?: string;
    transactions?: ITransactionJson[];
}

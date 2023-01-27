import { ITransactionData } from "../interfaces";
import { BigNumber } from "../utils";
import { ITransaction, ITransactionJson } from "./transactions";

export interface IBlockVerification {
    verified: boolean;
    errors: string[];
}

export interface IBlock {
    serialised: string;
    data: IBlockData;
    transactions: ITransaction[];
    verification: IBlockVerification;

    getBurnedFees(): BigNumber;
    getHeader(withBurnedFee?: boolean): IBlockData;
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
    totalFeeBurned?: BigNumber;
    reward: BigNumber;
    donations?: Record<string, BigNumber>;
    username?: string;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    signature?: string;
    serialised?: string;
    transactions?: ITransactionData[];
    ip?: string;
    fromOurNode?: boolean;
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
    totalFeeBurned: string;
    reward: string;
    donations: string;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    signature?: string;
    serialised?: string;
    transactions?: ITransactionJson[];
}

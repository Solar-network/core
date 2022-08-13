import { ITransactionData } from "../interfaces";
import { BigNumber } from "../utils";
import { ITransaction, ITransactionJson } from "./transactions";

export interface IBlockVerification {
    verified: boolean;
    errors: string[];
    containsMultiSignatures: boolean;
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
    burnedFee?: BigNumber;
    reward: BigNumber;
    devFund?: Record<string, BigNumber>;
    username?: string;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    blockSignature?: string;
    serialised?: string;
    transactions?: ITransactionData[];
    ip?: string;
    fromForger?: boolean;
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
    serialised?: string;
    transactions?: ITransactionJson[];
}

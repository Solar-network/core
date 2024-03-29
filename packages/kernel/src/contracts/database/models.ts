import { Utils } from "@solar-network/crypto";

export interface BlockModel {
    id: string;
    version: number;
    timestamp: number;
    previousBlock: string;
    height: number;
    numberOfTransactions: number;
    totalAmount: Utils.BigNumber;
    totalFee: Utils.BigNumber;
    burnedFee: Utils.BigNumber;
    reward: Utils.BigNumber;
    donations: Record<string, Utils.BigNumber>;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;
    blockSignature: string;
    username?: string;
}

export interface MissedBlockModel {
    timestamp: number;
    height: number;
    username: string;
}

export interface TransactionModel {
    id: string;
    version: number;
    blockId: string;
    blockHeight: number;
    sequence: number;
    timestamp: number;
    nonce: Utils.BigNumber;
    senderId: string;
    senderPublicKey: string;
    recipientId: string;
    type: number;
    typeGroup: number;
    memo: string | undefined;
    amount: Utils.BigNumber;
    fee: Utils.BigNumber;
    burnedFee: Utils.BigNumber;
    serialised: Buffer;
    asset: Record<string, any>;
}

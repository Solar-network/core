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
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;
    blockSignature: string;
}

export interface TransactionModel {
    id: string;
    version: number;
    blockId: string;
    blockHeight: number;
    sequence: number;
    timestamp: number;
    nonce: Utils.BigNumber;
    senderPublicKey: string;
    recipientId: string;
    type: number;
    typeGroup: number;
    vendorField: string | undefined;
    amount: Utils.BigNumber;
    fee: Utils.BigNumber;
    burnedFee: Utils.BigNumber;
    serialized: Buffer;
    asset: Record<string, any>;
}

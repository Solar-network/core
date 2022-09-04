import { Models } from "@solar-network/database";

export interface Codec {
    encodeBlock(block: any): Buffer;
    decodeBlock(buffer: Buffer): Models.Block;

    encodeMissedBlock(missedBlock: any): Buffer;
    decodeMissedBlock(buffer: Buffer): Models.MissedBlock;

    encodeTransaction(transaction: any): Buffer;
    decodeTransaction(buffer: Buffer): Models.Transaction;

    encodeRound(round: any): Buffer;
    decodeRound(buffer: Buffer): Models.Round;
}

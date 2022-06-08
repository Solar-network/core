import assert from "assert";
import ByteBuffer from "bytebuffer";

import { IBlock, IBlockData, ITransactionData } from "../interfaces";
import { Utils } from "../transactions";

export class Serialiser {
    public static size(block: IBlock): number {
        let size = this.headerSize(block.data) + block.data.blockSignature!.length / 2;

        for (const transaction of block.transactions) {
            size += 4 /* tx length */ + transaction.serialised.length;
        }

        return size;
    }

    public static serialiseWithTransactions(block: IBlockData): Buffer {
        const transactions: ITransactionData[] = block.transactions || [];
        block.numberOfTransactions = block.numberOfTransactions || transactions.length;

        const serialisedHeader: Buffer = this.serialise(block);

        const buff: ByteBuffer = new ByteBuffer(serialisedHeader.length + transactions.length * 4, true)
            .append(serialisedHeader)
            .skip(transactions.length * 4);

        for (let i = 0; i < transactions.length; i++) {
            const serialised: Buffer = Utils.toBytes(transactions[i]);
            buff.writeUint32(serialised.length, serialisedHeader.length + i * 4);
            buff.append(serialised);
        }

        return buff.flip().toBuffer();
    }

    public static serialise(block: IBlockData, includeSignature = true): Buffer {
        const buff: ByteBuffer = new ByteBuffer(512, true);

        this.serialiseHeader(block, buff);

        if (includeSignature) {
            this.serialiseSignature(block, buff);
        }

        return buff.flip().toBuffer();
    }

    private static headerSize(block: IBlockData): number {
        return (
            4 + // version
            4 + // timestamp
            4 + // height
            32 + // previousBlock
            4 + // numberOfTransactions
            8 + // totalAmount
            8 + // totalFee
            8 + // reward
            4 + // payloadLength
            block.payloadHash.length / 2 +
            block.generatorPublicKey.length / 2
        );
    }

    private static serialiseHeader(block: IBlockData, buff: ByteBuffer): void {
        buff.writeUint32(block.version);
        buff.writeUint32(block.timestamp);
        buff.writeUint32(block.height);
        buff.append(block.previousBlock, "hex");
        buff.writeUint32(block.numberOfTransactions);
        // @ts-ignore - The ByteBuffer types say we can't use strings but the code actually handles them.
        buff.writeUint64(block.totalAmount.toString());
        // @ts-ignore - The ByteBuffer types say we can't use strings but the code actually handles them.
        buff.writeUint64(block.totalFee.toString());
        // @ts-ignore - The ByteBuffer types say we can't use strings but the code actually handles them.
        buff.writeUint64(block.reward.toString());
        buff.writeUint32(block.payloadLength);
        buff.append(block.payloadHash, "hex");
        buff.append(block.generatorPublicKey, "hex");

        assert.strictEqual(buff.offset, this.headerSize(block));
    }

    private static serialiseSignature(block: IBlockData, buff: ByteBuffer): void {
        if (block.blockSignature) {
            buff.append(block.blockSignature, "hex");
        }
    }
}

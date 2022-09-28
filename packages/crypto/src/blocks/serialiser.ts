import assert from "assert";

import { IBlock, IBlockData, ITransactionData } from "../interfaces";
import { Utils } from "../transactions";
import { BigNumber, ByteBuffer } from "../utils";

export class Serialiser {
    public static size(block: IBlock): number {
        let size = this.headerSize() + block.data.blockSignature!.length / 2;

        for (const transaction of block.transactions) {
            size += 4 + transaction.serialised.length;
        }

        return size;
    }

    public static serialiseWithTransactions(block: IBlockData): Buffer {
        const transactions: ITransactionData[] = block.transactions || [];
        block.numberOfTransactions = block.numberOfTransactions || transactions.length;

        const serialisedHeader: Buffer = this.serialise(block);

        const transactionBytes: Buffer[] = [];
        let transactionLength: number = 0;

        for (const transaction of transactions) {
            const serialised: Buffer = Utils.toBytes(transaction);
            transactionLength += serialised.length + 4;
            transactionBytes.push(serialised);
        }

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(transactionLength + serialisedHeader.length));
        buf.writeBuffer(serialisedHeader);
        buf.jump(transactions.length * 4);
        for (let i = 0; i < transactionBytes.length; i++) {
            const offset = buf.getOffset();
            buf.goTo(serialisedHeader.length + i * 4);
            buf.writeUInt32LE(transactionBytes[i].length);
            buf.goTo(offset);
            buf.writeBuffer(transactionBytes[i]);
        }

        return buf.getResult();
    }

    public static serialise(block: IBlockData, includeSignature = true): Buffer {
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(this.headerSize() + 64));

        this.serialiseHeader(block, buf);

        if (includeSignature) {
            this.serialiseSignature(block, buf);
        }

        return buf.getResult();
    }

    private static headerSize(): number {
        return 141;
    }

    private static serialiseHeader(block: IBlockData, buf: ByteBuffer): void {
        buf.writeUInt32LE(block.version);
        buf.writeUInt32LE(block.timestamp);
        buf.writeUInt32LE(block.height);
        buf.writeBuffer(Buffer.from(block.previousBlock, "hex"));
        buf.writeUInt32LE(block.numberOfTransactions);
        buf.writeBigUInt64LE(BigNumber.make(block.totalAmount).toBigInt());
        buf.writeBigUInt64LE(BigNumber.make(block.totalFee).toBigInt());
        buf.writeBigUInt64LE(BigNumber.make(block.reward).toBigInt());
        buf.writeUInt32LE(block.payloadLength);
        buf.writeBuffer(Buffer.from(block.payloadHash, "hex"));
        buf.writeBuffer(Buffer.from(block.generatorPublicKey, "hex"));

        assert.strictEqual(buf.getOffset(), this.headerSize());
    }

    private static serialiseSignature(block: IBlockData, buf: ByteBuffer): void {
        if (block.blockSignature) {
            buf.writeBuffer(Buffer.from(block.blockSignature, "hex"));
        }
    }
}

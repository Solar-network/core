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

        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(transactionLength + serialisedHeader.length));
        buff.writeBuffer(serialisedHeader);
        buff.jump(transactions.length * 4);
        for (let i = 0; i < transactionBytes.length; i++) {
            const offset = buff.getOffset();
            buff.goTo(serialisedHeader.length + i * 4);
            buff.writeUInt32LE(transactionBytes[i].length);
            buff.goTo(offset);
            buff.writeBuffer(transactionBytes[i]);
        }

        return buff.getResult();
    }

    public static serialise(block: IBlockData, includeSignature = true): Buffer {
        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(this.headerSize() + 64));

        this.serialiseHeader(block, buff);

        if (includeSignature) {
            this.serialiseSignature(block, buff);
        }

        return buff.getResult();
    }

    private static headerSize(): number {
        return 141;
    }

    private static serialiseHeader(block: IBlockData, buff: ByteBuffer): void {
        buff.writeUInt32LE(block.version);
        buff.writeUInt32LE(block.timestamp);
        buff.writeUInt32LE(block.height);
        buff.writeBuffer(Buffer.from(block.previousBlock, "hex"));
        buff.writeUInt32LE(block.numberOfTransactions);
        buff.writeBigUInt64LE(BigNumber.make(block.totalAmount).toBigInt());
        buff.writeBigUInt64LE(BigNumber.make(block.totalFee).toBigInt());
        buff.writeBigUInt64LE(BigNumber.make(block.reward).toBigInt());
        buff.writeUInt32LE(block.payloadLength);
        buff.writeBuffer(Buffer.from(block.payloadHash, "hex"));
        buff.writeBuffer(Buffer.from(block.generatorPublicKey, "hex"));

        assert.strictEqual(buff.getOffset(), this.headerSize());
    }

    private static serialiseSignature(block: IBlockData, buff: ByteBuffer): void {
        if (block.blockSignature) {
            buff.writeBuffer(Buffer.from(block.blockSignature, "hex"));
        }
    }
}

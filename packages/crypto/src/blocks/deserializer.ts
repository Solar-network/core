import ByteBuffer from "bytebuffer";

import { IBlockData, ITransaction } from "../interfaces";
import { TransactionFactory } from "../transactions";
import { BigNumber } from "../utils";
import { Block } from "./block";

export class Deserializer {
    public static deserialize(
        serialized: Buffer,
        headerOnly: boolean = false,
        options: { deserializeTransactionsUnchecked?: boolean } = {},
    ): { data: IBlockData; transactions: ITransaction[] } {
        const block = {} as IBlockData;
        let transactions: ITransaction[] = [];

        const buf: ByteBuffer = new ByteBuffer(serialized.length, true);
        buf.append(serialized);
        buf.reset();

        this.deserializeHeader(block, buf);

        headerOnly = headerOnly || buf.remaining() === 0;
        if (!headerOnly) {
            transactions = this.deserializeTransactions(block, buf, options.deserializeTransactionsUnchecked);
        }

        block.id = Block.getId(block);

        return { data: block, transactions };
    }

    private static deserializeHeader(block: IBlockData, buf: ByteBuffer): void {
        block.version = buf.readUint32();
        block.timestamp = buf.readUint32();
        block.height = buf.readUint32();
        block.previousBlock = buf.readBytes(32).toString("hex");
        block.numberOfTransactions = buf.readUint32();
        block.totalAmount = BigNumber.make(buf.readUint64().toString());
        block.totalFee = BigNumber.make(buf.readUint64().toString());
        block.reward = BigNumber.make(buf.readUint64().toString());
        block.payloadLength = buf.readUint32();
        block.payloadHash = buf.readBytes(32).toString("hex");
        block.generatorPublicKey = buf.readBytes(33).toString("hex");
        block.blockSignature = buf.readBytes(64).toString("hex");
    }

    private static deserializeTransactions(
        block: IBlockData,
        buf: ByteBuffer,
        deserializeTransactionsUnchecked: boolean = false,
    ): ITransaction[] {
        const transactionLengths: number[] = [];

        for (let i = 0; i < block.numberOfTransactions; i++) {
            transactionLengths.push(buf.readUint32());
        }

        const transactions: ITransaction[] = [];
        block.transactions = [];
        for (const length of transactionLengths) {
            const transactionBytes = buf.readBytes(length).toBuffer();
            const transaction = deserializeTransactionsUnchecked
                ? TransactionFactory.fromBytesUnsafe(transactionBytes)
                : TransactionFactory.fromBytes(transactionBytes);
            transactions.push(transaction);
            block.transactions.push(transaction.data);
        }

        return transactions;
    }
}

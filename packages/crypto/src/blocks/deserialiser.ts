import ByteBuffer from "bytebuffer";

import { IBlockData, ITransaction } from "../interfaces";
import { TransactionFactory } from "../transactions";
import { BigNumber } from "../utils";
import { Block } from "./block";

export class Deserialiser {
    public static deserialise(
        serialised: Buffer,
        headerOnly: boolean = false,
        options: { deserialiseTransactionsUnchecked?: boolean } = {},
    ): { data: IBlockData; transactions: ITransaction[] } {
        const block = {} as IBlockData;
        let transactions: ITransaction[] = [];

        const buf: ByteBuffer = new ByteBuffer(serialised.length, true);
        buf.append(serialised);
        buf.reset();

        this.deserialiseHeader(block, buf);

        headerOnly = headerOnly || buf.remaining() === 0;
        if (!headerOnly) {
            transactions = this.deserialiseTransactions(block, buf, options.deserialiseTransactionsUnchecked);
        }

        block.id = Block.getId(block);

        return { data: block, transactions };
    }

    private static deserialiseHeader(block: IBlockData, buf: ByteBuffer): void {
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

    private static deserialiseTransactions(
        block: IBlockData,
        buf: ByteBuffer,
        deserialiseTransactionsUnchecked: boolean = false,
    ): ITransaction[] {
        const transactionLengths: number[] = [];

        for (let i = 0; i < block.numberOfTransactions; i++) {
            transactionLengths.push(buf.readUint32());
        }

        const transactions: ITransaction[] = [];
        block.transactions = [];
        for (const length of transactionLengths) {
            const transactionBytes = buf.readBytes(length).toBuffer();
            const transaction = deserialiseTransactionsUnchecked
                ? TransactionFactory.fromBytesUnsafe(transactionBytes)
                : TransactionFactory.fromBytes(transactionBytes);
            transactions.push(transaction);
            block.transactions.push(transaction.data);
        }

        return transactions;
    }
}

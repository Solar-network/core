import { IBlockData, ITransaction } from "../interfaces";
import { TransactionFactory } from "../transactions";
import { BigNumber, ByteBuffer } from "../utils";
import { Block } from "./block";

export class Deserialiser {
    public static deserialise(
        serialised: Buffer,
        headerOnly: boolean = false,
        options: { deserialiseTransactionsUnchecked?: boolean } = {},
    ): { data: IBlockData; transactions: ITransaction[] } {
        const block = {} as IBlockData;
        let transactions: ITransaction[] = [];

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(serialised.length));
        buf.writeBuffer(serialised);
        buf.reset();

        this.deserialiseHeader(block, buf);

        headerOnly = headerOnly || buf.getRemainderLength() === 0;
        if (!headerOnly) {
            transactions = this.deserialiseTransactions(block, buf, options.deserialiseTransactionsUnchecked);
        }

        block.id = Block.getId(block);

        return { data: block, transactions };
    }

    private static deserialiseHeader(block: IBlockData, buf: ByteBuffer): void {
        block.version = buf.readUInt32LE();
        block.timestamp = buf.readUInt32LE();
        block.height = buf.readUInt32LE();
        block.previousBlock = buf.readBuffer(32).toString("hex");
        block.numberOfTransactions = buf.readUInt32LE();
        block.totalAmount = BigNumber.make(buf.readBigUInt64LE().toString());
        block.totalFee = BigNumber.make(buf.readBigUInt64LE().toString());
        block.reward = BigNumber.make(buf.readBigUInt64LE().toString());
        block.payloadLength = buf.readUInt32LE();
        block.payloadHash = buf.readBuffer(32).toString("hex");
        block.generatorPublicKey = buf.readBuffer(33).toString("hex");
        block.blockSignature = buf.readBuffer(64).toString("hex");
    }

    private static deserialiseTransactions(
        block: IBlockData,
        buf: ByteBuffer,
        deserialiseTransactionsUnchecked: boolean = false,
    ): ITransaction[] {
        const transactionLengths: number[] = [];

        for (let i = 0; i < block.numberOfTransactions; i++) {
            transactionLengths.push(buf.readUInt32LE());
        }

        const transactions: ITransaction[] = [];
        block.transactions = [];
        for (const length of transactionLengths) {
            const transactionBytes = buf.readBuffer(length);
            const transaction = deserialiseTransactionsUnchecked
                ? TransactionFactory.fromBytesUnsafe(transactionBytes)
                : TransactionFactory.fromBytes(transactionBytes);
            transactions.push(transaction);
            block.transactions.push(transaction.data);
        }

        return transactions;
    }
}

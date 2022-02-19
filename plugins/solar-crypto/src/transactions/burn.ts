import { Transactions, Utils } from "@arkecosystem/crypto";

import { SolarTransactionGroup, SolarTransactionType } from "../enums";

const { schemas } = Transactions;

export class BurnTransaction extends Transactions.Transaction {
    public static typeGroup: number = SolarTransactionGroup;
    public static type: number = SolarTransactionType.Burn;
    public static key: string = "burn";
    public static version: number = 2;

    protected static defaultStaticFee = Utils.BigNumber.ZERO;

    public static getSchema(): Transactions.schemas.TransactionSchema {
        return schemas.extend(schemas.transactionBaseSchema, {
            $id: "burn",
            required: ["typeGroup"],
            properties: {
                type: { transactionType: SolarTransactionType.Burn },
                typeGroup: { const: SolarTransactionGroup },
                amount: { bignumber: { minimum: 0 } },
            },
        });
    }
    public serialize(): Utils.ByteBuffer {
        const { data } = this;
        const buff: Utils.ByteBuffer = new Utils.ByteBuffer(Buffer.alloc(8));
        buff.writeBigUInt64LE(data.amount.toBigInt());
        return buff;
    }

    public deserialize(buf: Utils.ByteBuffer): void {
        const { data } = this;
        data.amount = Utils.BigNumber.make(buf.readBigUInt64LE().toString());
    }
}

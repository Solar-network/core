import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber } from "../../../utils/bignum";
import { ByteBuffer } from "../../../utils/byte-buffer";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export class BurnTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Solar;
    public static type: number = TransactionType.Solar.Burn;
    public static key: string = "burn";
    public static version: number = 2;

    protected static defaultStaticFee = BigNumber.ZERO;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.extend(schemas.transactionBaseSchema, {
            $id: "burn",
            required: ["typeGroup"],
            properties: {
                type: { transactionType: TransactionType.Solar.Burn },
                typeGroup: { const: TransactionTypeGroup.Solar },
                amount: { bignumber: { minimum: 0 } },
            },
        });
    }
    public serialize(): ByteBuffer {
        const { data } = this;
        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(8));
        buff.writeBigUInt64LE(data.amount.toBigInt());
        return buff;
    }

    public deserialize(buf: ByteBuffer): void {
        const { data } = this;
        data.amount = BigNumber.make(buf.readBigUInt64LE().toString());
    }
}

import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber } from "../../../utils/big-number";
import { ByteBuffer } from "../../../utils/byte-buffer";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export class BurnTransaction extends Transaction {
    public static emoji: string = "🔥";
    public static key: string = "burn";
    public static type: number = TransactionType.Solar.Burn;
    public static typeGroup: number = TransactionTypeGroup.Solar;

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

    public serialise(): ByteBuffer {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(8));
        buf.writeBigUInt64LE(data.amount!.toBigInt());
        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        data.amount = BigNumber.make(buf.readBigUInt64LE().toString());
    }
}

import { BigNumber } from "../../utils/big-number";
import { ByteBuffer } from "../../utils/byte-buffer";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export class BurnTransaction extends Transaction {
    public static emoji: string = "🔥";
    public static key: string = "burn";

    public static getSchema(): schemas.TransactionSchema {
        return schemas.burn;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;
        if (data.asset && data.asset.burn) {
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(8));
            buf.writeBigUInt64LE(data.asset.burn.amount.toBigInt());
            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        data.asset = { burn: { amount: BigNumber.make(buf.readBigUInt64LE().toString()) } };
    }
}

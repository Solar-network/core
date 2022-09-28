import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcRefundTransaction extends Transaction {
    public static emoji: string = "🔓";
    public static key = "htlcRefund";
    public static type: number = TransactionType.Core.HtlcRefund;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.ZERO;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcRefund;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(32));

        if (data.asset && data.asset.refund) {
            buf.writeBuffer(Buffer.from(data.asset.refund.lockTransactionId, "hex"));
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;

        const lockTransactionId: string = buf.readBuffer(32).toString("hex");

        data.asset = {
            refund: {
                lockTransactionId,
            },
        };
    }
}

import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { configManager } from "../../../managers";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcRefundTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.HtlcRefund;
    public static key = "htlcRefund";

    protected static defaultStaticFee: BigNumber = BigNumber.ZERO;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcRefund;
    }

    public verify(): boolean {
        return configManager.getMilestone().htlcEnabled && super.verify();
    }

    public serialize(): ByteBuffer | undefined {
        const { data } = this;

        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(32));

        if (data.asset && data.asset.refund) {
            buff.writeBuffer(Buffer.from(data.asset.refund.lockTransactionId, "hex"));
        }

        return buff;
    }

    public deserialize(buf: ByteBuffer): void {
        const { data } = this;

        const lockTransactionId: string = buf.readBuffer(32).toString("hex");

        data.asset = {
            refund: {
                lockTransactionId,
            },
        };
    }
}

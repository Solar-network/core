import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber } from "../../../utils/big-number";
import { ByteBuffer } from "../../../utils/byte-buffer";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class DelegateResignationTransaction extends Transaction {
    public static emoji: string = "💔";
    public static key = "delegateResignation";
    public static type: number = TransactionType.Core.DelegateResignation;
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static unique: boolean = true;

    protected static defaultStaticFee: BigNumber = BigNumber.make("2500000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.delegateResignation;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (!data.asset || !data.asset.resignationType) {
            return new ByteBuffer(Buffer.alloc(0));
        }

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(1));
        buf.writeUInt8(0xff - data.asset.resignationType);

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const remainderLength: number = buf.getRemainderLength();
        if (
            (remainderLength <= 128 && remainderLength % 64 === 0) ||
            (remainderLength >= 130 && remainderLength % 65 === 0)
        ) {
            return;
        }

        const resignationType: number = buf.readUInt8();

        // make sure this is not a signatures array with only one signature since that can be in the range 00-0F here
        if (resignationType <= 0x0f) {
            buf.jump(-1);
            return;
        }

        data.asset = {
            resignationType: 0xff - resignationType,
        };
    }
}

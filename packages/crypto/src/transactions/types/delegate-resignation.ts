import { ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class DelegateResignationTransaction extends Transaction {
    public static emoji: string = "💔";
    public static key = "delegateResignation";
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.delegateResignation;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (!data.asset || !data.asset.resignation || !data.asset.resignation.type) {
            return new ByteBuffer(Buffer.alloc(0));
        }

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(1));
        buf.writeUInt8(0xff - data.asset.resignation.type);

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const remainderLength: number = buf.getRemainderLength();
        let resignation: number;

        if (
            (remainderLength <= 128 && remainderLength % 64 === 0) ||
            (remainderLength >= 130 && remainderLength % 65 === 0)
        ) {
            resignation = 0xff;
        } else {
            resignation = buf.readUInt8();
        }

        // make sure this is not a signatures array with only one signature since that can be in the range 00-0F here
        if (resignation <= 0x0f) {
            buf.jump(-1);
            return;
        }

        data.asset = {
            resignation: {
                type: 0xff - resignation,
            },
        };
    }
}

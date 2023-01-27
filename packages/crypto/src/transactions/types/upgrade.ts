import { ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class UpgradeTransaction extends Transaction {
    public static emoji: string = "👷";
    public static key = "upgrade";
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.upgrade;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(144));

        if (data.asset && data.asset.blockProducer) {
            buf.writeBuffer(Buffer.from(data.asset.blockProducer.publicKey, "hex"));
            buf.writeBuffer(Buffer.from(data.asset.blockProducer.signature, "hex"));
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;

        data.asset = {
            blockProducer: {
                publicKey: buf.readBuffer(48).toString("hex"),
                signature: buf.readBuffer(96).toString("hex"),
            },
        };
    }
}

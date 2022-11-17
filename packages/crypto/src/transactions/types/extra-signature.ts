import { ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class ExtraSignatureRegistrationTransaction extends Transaction {
    public static emoji: string = "🖋️";
    public static key = "extraSignature";
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.extraSignature;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(33));

        if (data.asset && data.asset.signature) {
            buf.writeBuffer(Buffer.from(data.asset.signature.publicKey, "hex"));
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;

        data.asset = {
            signature: {
                publicKey: buf.readBuffer(33).toString("hex"),
            },
        };
    }
}

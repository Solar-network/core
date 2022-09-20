import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class ExtraSignatureRegistrationTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.ExtraSignature;
    public static key = "extraSignature";
    public static unique: boolean = true;

    protected static defaultStaticFee: BigNumber = BigNumber.make("500000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.extraSignature;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;
        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(33));

        if (data.asset && data.asset.signature) {
            buff.writeBuffer(Buffer.from(data.asset.signature.publicKey, "hex"));
        }

        return buff;
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

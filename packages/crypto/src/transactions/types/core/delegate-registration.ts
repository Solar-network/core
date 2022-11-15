import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class DelegateRegistrationTransaction extends Transaction {
    public static emoji: string = "🐣";
    public static key = "delegateRegistration";
    public static type: number = TransactionType.Core.DelegateRegistration;
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.delegateRegistration;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.delegate) {
            const delegateBytes: Buffer = Buffer.from(data.asset.delegate.username, "utf8");
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(delegateBytes.length + 1));

            buf.writeUInt8(delegateBytes.length);
            buf.writeBuffer(delegateBytes);

            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const usernameLength = buf.readUInt8();

        data.asset = {
            delegate: {
                username: buf.readBuffer(usernameLength).toString("utf8"),
            },
        };
    }
}

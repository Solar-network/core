import { ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class RegistrationTransaction extends Transaction {
    public static emoji: string = "🐣";
    public static key = "registration";
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.registration;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.registration) {
            const usernameBytes: Buffer = Buffer.from(data.asset.registration.username, "utf8");
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(usernameBytes.length + 1));

            buf.writeUInt8(usernameBytes.length);
            buf.writeBuffer(usernameBytes);

            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const usernameLength = buf.readUInt8();

        data.asset = {
            registration: {
                username: buf.readBuffer(usernameLength).toString("utf8"),
            },
        };
    }
}

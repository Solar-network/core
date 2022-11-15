import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcClaimTransaction extends Transaction {
    public static emoji: string = "🔐";
    public static key = "htlcClaim";
    public static type: number = TransactionType.Core.HtlcClaim;
    public static typeGroup: number = TransactionTypeGroup.Core;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcClaim;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (!data.asset || !data.asset.claim) {
            return new ByteBuffer(Buffer.alloc(0));
        }

        const unlockSecret: Buffer = Buffer.from(data.asset.claim.unlockSecret, "hex");
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(34 + unlockSecret.length));
        buf.writeUInt8(data.asset.claim.hashType);
        buf.writeBuffer(Buffer.from(data.asset.claim.lockTransactionId, "hex"));
        buf.writeUInt8(unlockSecret.length);
        buf.writeBuffer(unlockSecret);

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;

        const hashType: number = buf.readUInt8();
        const lockTransactionId: string = buf.readBuffer(32).toString("hex");

        const unlockSecretLength: number = buf.readUInt8();
        const unlockSecret: string = buf.readBuffer(unlockSecretLength).toString("hex");

        data.asset = {
            claim: {
                hashType,
                lockTransactionId,
                unlockSecret,
            },
        };
    }
}

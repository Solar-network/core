import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcClaimTransaction extends Transaction {
    public static emoji: string = "🔐";
    public static key = "htlcClaim";
    public static type: number = TransactionType.Core.HtlcClaim;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.ZERO;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcClaim;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (!data.asset || !data.asset.claim) {
            return new ByteBuffer(Buffer.alloc(0));
        }

        const unlockSecret: Buffer = Buffer.from(data.asset.claim.unlockSecret, "hex");
        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(34 + unlockSecret.length));
        buff.writeUInt8(data.asset.claim.hashType);
        buff.writeBuffer(Buffer.from(data.asset.claim.lockTransactionId, "hex"));
        buff.writeUInt8(unlockSecret.length);
        buff.writeBuffer(unlockSecret);

        return buff;
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

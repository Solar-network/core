import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { configManager } from "../../../managers";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcClaimTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.HtlcClaim;
    public static key = "htlcClaim";

    protected static defaultStaticFee: BigNumber = BigNumber.ZERO;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcClaim;
    }

    public verify(): boolean {
        return configManager.getMilestone().htlcEnabled && super.verify();
    }

    public serialize(): ByteBuffer | undefined {
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

    public deserialize(buf: ByteBuffer): void {
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

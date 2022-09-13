import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { IDeserialiseAddresses, ISerialiseOptions } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class HtlcLockTransaction extends Transaction {
    public static emoji: string = "🔒";
    public static key = "htlcLock";
    public static type: number = TransactionType.Core.HtlcLock;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.make("10000000");

    public get addresses(): IDeserialiseAddresses {
        const addresses = super.addresses;
        addresses.recipientId = [this.data.recipientId!];
        return addresses;
    }

    public static getSchema(): schemas.TransactionSchema {
        return schemas.htlcLock;
    }

    public serialise(options?: ISerialiseOptions): ByteBuffer | undefined {
        const { data } = this;

        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(99));

        buff.writeBigUInt64LE(data.amount.toBigInt());

        if (data.asset && data.asset.lock) {
            const secretHash: Buffer = Buffer.from(data.asset.lock.secretHash, "hex");
            buff.writeUInt8(secretHash.length);
            buff.writeBuffer(secretHash);
            buff.writeUInt8(data.asset.lock.expiration.type);
            buff.writeUInt32LE(data.asset.lock.expiration.value);
        }

        if (data.recipientId) {
            const { addressBuffer, addressError } = Address.toBuffer(data.recipientId);

            if (options) {
                options.addressError = addressError;
            }

            buff.writeBuffer(addressBuffer);
        }

        return buff;
    }

    public deserialise(buf: ByteBuffer, transactionAddresses?: IDeserialiseAddresses): void {
        const { data } = this;

        const amount: BigNumber = BigNumber.make(buf.readBigUInt64LE().toString());
        const secretHashLength: number = buf.readUInt8();
        const secretHash: string = buf.readBuffer(secretHashLength).toString("hex");
        const expirationType: number = buf.readUInt8();
        const expirationValue: number = buf.readUInt32LE();
        data.amount = amount;
        if (transactionAddresses?.recipientId) {
            data.recipientId = transactionAddresses.recipientId[0];
            buf.jump(21);
        } else {
            data.recipientId = Address.fromBuffer(buf.readBuffer(21));
        }
        data.asset = {
            lock: {
                secretHash,
                expiration: {
                    type: expirationType,
                    value: expirationValue,
                },
            },
        };
    }
}

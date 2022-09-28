import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { IDeserialiseAddresses, ISerialiseOptions } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class LegacyTransferTransaction extends Transaction {
    public static emoji: string = "💸";
    public static key = "legacyTransfer";
    public static type: number = TransactionType.Core.LegacyTransfer;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.make("10000000");

    public get addresses(): IDeserialiseAddresses {
        const addresses = super.addresses;
        addresses.recipientId = [this.data.recipientId!];
        return addresses;
    }

    public static getSchema(): schemas.TransactionSchema {
        return schemas.legacyTransfer;
    }

    public serialise(options?: ISerialiseOptions): ByteBuffer | undefined {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(33));
        buf.writeBigUInt64LE(data.amount.toBigInt());
        buf.writeUInt32LE(data.expiration || 0);

        if (data.recipientId) {
            const { addressBuffer, addressError } = Address.toBuffer(data.recipientId);

            if (options) {
                options.addressError = addressError;
            }

            buf.writeBuffer(addressBuffer);
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer, transactionAddresses?: IDeserialiseAddresses): void {
        const { data } = this;
        data.amount = BigNumber.make(buf.readBigUInt64LE().toString());
        data.expiration = buf.readUInt32LE();

        if (transactionAddresses?.recipientId) {
            data.recipientId = transactionAddresses.recipientId[0];
            buf.jump(21);
        } else {
            data.recipientId = Address.fromBuffer(buf.readBuffer(21));
        }
    }
}

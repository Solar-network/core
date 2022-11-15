import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { IDeserialiseAddresses, ISerialiseOptions, ITransferRecipient } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class TransferTransaction extends Transaction {
    public static emoji: string = "💸";
    public static key = "transfer";
    public static type: number = TransactionType.Core.Transfer;
    public static typeGroup: number = TransactionTypeGroup.Core;

    public get addresses(): IDeserialiseAddresses {
        const addresses = super.addresses;
        addresses.recipientId = this.data.asset?.recipients?.map((transfer) => transfer.recipientId);
        return addresses;
    }

    public static getSchema(): schemas.TransactionSchema {
        return schemas.transfer;
    }

    public serialise(options: ISerialiseOptions = {}): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.recipients) {
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(2 + data.asset.recipients.length * 29));
            buf.writeUInt16LE(data.asset.recipients.length);

            for (const transfer of data.asset.recipients) {
                buf.writeBigUInt64LE(transfer.amount.toBigInt());

                const { addressBuffer, addressError } = Address.toBuffer(transfer.recipientId);
                options.addressError = addressError || options.addressError;

                buf.writeBuffer(addressBuffer);
            }

            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer, transactionAddresses?: IDeserialiseAddresses): void {
        const { data } = this;
        const recipients: ITransferRecipient[] = [];
        const total: number = buf.readUInt16LE();

        for (let j = 0; j < total; j++) {
            const amount: BigNumber = BigNumber.make(buf.readBigUInt64LE().toString());
            let recipientId: string;
            if (transactionAddresses?.recipientId) {
                recipientId = transactionAddresses.recipientId[j];
                buf.jump(21);
            } else {
                recipientId = Address.fromBuffer(buf.readBuffer(21));
            }

            recipients.push({
                amount,
                recipientId,
            });
        }
        data.asset = { recipients };
    }
}

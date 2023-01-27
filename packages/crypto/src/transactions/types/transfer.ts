import { TransferType } from "../../enums";
import { Address } from "../../identities";
import { IDeserialiseAddresses, IDeserialiseOptions, ISerialiseOptions, ITransferRecipient } from "../../interfaces";
import { BigNumber, ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class TransferTransaction extends Transaction {
    public static emoji: string = "💸";
    public static key = "transfer";

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
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(4 + data.asset.recipients.length * 29));
            if (this.internalType === TransferType.Multiple) {
                buf.writeUInt16LE(data.asset.recipients.length);
            } else if (data.asset.recipients.length > 1) {
                data.asset.recipients = data.asset.recipients.slice(0, 1);
            }
            for (const transfer of data.asset.recipients) {
                buf.writeBigUInt64LE(transfer.amount.toBigInt());

                const { addressBuffer, addressError } = Address.toBuffer(transfer.recipientId);

                if (options) {
                    options.addressError = addressError || options.addressError;
                }

                if (this.internalType === TransferType.Single) {
                    buf.writeUInt32LE(data.expiration ?? 0);
                }

                buf.writeBuffer(addressBuffer);
            }

            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer, options: IDeserialiseOptions = {}): void {
        const { transactionAddresses }: { transactionAddresses?: IDeserialiseAddresses } = options;
        const { data } = this;
        const recipients: ITransferRecipient[] = [];
        if (this.internalType === TransferType.Multiple) {
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
        } else {
            const amount: BigNumber = BigNumber.make(buf.readBigUInt64LE().toString());
            const expiration = buf.readUInt32LE();
            if (expiration > 0) {
                data.expiration = expiration;
            }
            let recipientId: string;
            if (transactionAddresses?.recipientId) {
                recipientId = transactionAddresses.recipientId[0];
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

import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { IDeserialiseAddresses, ISerialiseOptions, ITransferItem } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class TransferTransaction extends Transaction {
    public static emoji: string = "💸";
    public static key = "transfer";
    public static type: number = TransactionType.Core.Transfer;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.make("10000000");

    public get addresses(): IDeserialiseAddresses {
        const addresses = super.addresses;
        addresses.recipientId = this.data.asset?.transfers?.map((transfer) => transfer.recipientId);
        return addresses;
    }

    public static getSchema(): schemas.TransactionSchema {
        return schemas.transfer;
    }

    public serialise(options: ISerialiseOptions = {}): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.transfers) {
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(2 + data.asset.transfers.length * 29));
            buf.writeUInt16LE(data.asset.transfers.length);

            for (const transfer of data.asset.transfers) {
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
        const transfers: ITransferItem[] = [];
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

            transfers.push({
                amount,
                recipientId,
            });
        }
        data.asset = { transfers };
    }
}

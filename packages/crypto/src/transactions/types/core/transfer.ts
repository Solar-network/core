import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { ISerialiseOptions, ITransferItem } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class TransferTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.Transfer;
    public static key = "transfer";

    protected static defaultStaticFee: BigNumber = BigNumber.make("10000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.transfer;
    }

    public serialise(options: ISerialiseOptions = {}): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.transfers) {
            const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(2 + data.asset.transfers.length * 29));
            buff.writeUInt16LE(data.asset.transfers.length);

            for (const transfer of data.asset.transfers) {
                buff.writeBigUInt64LE(transfer.amount.toBigInt());

                const { addressBuffer, addressError } = Address.toBuffer(transfer.recipientId);
                options.addressError = addressError || options.addressError;

                buff.writeBuffer(addressBuffer);
            }

            return buff;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const transfers: ITransferItem[] = [];
        const total: number = buf.readUInt16LE();

        for (let j = 0; j < total; j++) {
            transfers.push({
                amount: BigNumber.make(buf.readBigUInt64LE().toString()),
                recipientId: Address.fromBuffer(buf.readBuffer(21)),
            });
        }

        data.asset = { transfers };
    }
}

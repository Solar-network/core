import { TransactionHeaderType, TransactionType } from "../enums";
import { InvalidTransactionBytesError, TransactionVersionError } from "../errors";
import { Address } from "../identities";
import { IDeserialiseAddresses, IDeserialiseOptions, ITransaction, ITransactionData } from "../interfaces";
import { BigNumber, ByteBuffer, isSupportedTransactionVersion } from "../utils";
import { InternalTransactionType, TransactionTypeFactory } from "./types";

export class Deserialiser {
    public static deserialise(serialised: string | Buffer, options: IDeserialiseOptions = {}): ITransaction {
        const data = {} as ITransactionData;

        const buf: ByteBuffer = this.getByteBuffer(serialised);
        const internalType: string = this.deserialiseCommon(data, buf, options.transactionAddresses);

        const instance: ITransaction = TransactionTypeFactory.create(data);
        instance.internalType = internalType;

        if (options.index === undefined) {
            options.index = TransactionType[data.type].findIndex((id: string) => id === internalType);
        }

        this.deserialiseMemo(instance, buf);

        instance.deserialise(buf, options);

        this.deserialiseSignatures(instance, buf);

        if (data.version) {
            if (
                options.acceptLegacyVersion ||
                options.disableVersionCheck ||
                isSupportedTransactionVersion(data.version)
            ) {
            } else {
                throw new TransactionVersionError(data.version);
            }
        }

        instance.serialised = buf.getResult();
        return instance;
    }

    private static deserialiseCommon(
        data: ITransactionData,
        buf: ByteBuffer,
        transactionAddresses?: IDeserialiseAddresses,
    ): string {
        data.headerType = 0xff - buf.readUInt8();
        data.version = buf.readUInt8();
        data.network = buf.readUInt8();

        const group: number = buf.readUInt32LE();
        const type: number = buf.readUInt16LE();

        data.type = InternalTransactionType.from(type, group).key!;

        data.nonce = BigNumber.make(buf.readBigUInt64LE());

        data.senderPublicKey = buf.readBuffer(33).toString("hex");

        if (data.headerType === TransactionHeaderType.Standard) {
            data.senderId = Address.fromPublicKey(data.senderPublicKey);
        } else {
            if (transactionAddresses?.senderId) {
                data.senderId = transactionAddresses.senderId;
                buf.jump(21);
            } else {
                data.senderId = Address.fromBuffer(buf.readBuffer(21));
            }
        }

        data.fee = BigNumber.make(buf.readBigUInt64LE().toString());

        return `${group}/${type}`;
    }

    private static deserialiseMemo(transaction: ITransaction, buf: ByteBuffer): void {
        const memoLength: number = buf.readUInt8();
        if (memoLength > 0) {
            const memoBuffer: Buffer = buf.readBuffer(memoLength);
            transaction.data.memo = memoBuffer.toString("utf8");
        }
    }

    private static deserialiseSignatures(transaction: ITransaction, buf: ByteBuffer): void {
        const { data }: ITransaction = transaction;

        const canRead = () => {
            return buf.getRemainderLength() && buf.getRemainderLength() % 64 === 0;
        };

        if (canRead()) {
            data.signatures = { primary: buf.readBuffer(64).toString("hex") };
        }

        if (canRead()) {
            data.signatures!.extra = buf.readBuffer(64).toString("hex");
        }

        if (buf.getRemainderLength()) {
            throw new InvalidTransactionBytesError("signature buffer not exhausted");
        }
    }

    private static getByteBuffer(serialised: Buffer | string): ByteBuffer {
        if (!(serialised instanceof Buffer)) {
            serialised = Buffer.from(serialised, "hex");
        }

        return new ByteBuffer(serialised);
    }
}

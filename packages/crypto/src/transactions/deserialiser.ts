import { TransactionHeaderType } from "../enums";
import { InvalidTransactionBytesError, TransactionVersionError } from "../errors";
import { Address } from "../identities";
import { IDeserialiseAddresses, IDeserialiseOptions, ITransaction, ITransactionData } from "../interfaces";
import { BigNumber, ByteBuffer, isSupportedTransactionVersion } from "../utils";
import { TransactionTypeFactory } from "./types";

export class Deserialiser {
    public static deserialise(serialised: string | Buffer, options: IDeserialiseOptions = {}): ITransaction {
        const data = {} as ITransactionData;

        const buf: ByteBuffer = this.getByteBuffer(serialised);
        this.deserialiseCommon(data, buf, options.transactionAddresses);

        const instance: ITransaction = TransactionTypeFactory.create(data);
        this.deserialiseMemo(instance, buf);

        // Deserialise type specific parts
        instance.deserialise(buf, options.transactionAddresses);

        this.deserialiseSignatures(data, buf);

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

    public static deserialiseCommon(
        transaction: ITransactionData,
        buf: ByteBuffer,
        transactionAddresses?: IDeserialiseAddresses,
    ): void {
        transaction.headerType = 0xff - buf.readUInt8();
        transaction.version = buf.readUInt8();
        transaction.network = buf.readUInt8();

        transaction.typeGroup = buf.readUInt32LE();
        transaction.type = buf.readUInt16LE();
        transaction.nonce = BigNumber.make(buf.readBigUInt64LE());

        transaction.senderPublicKey = buf.readBuffer(33).toString("hex");

        if (transaction.headerType === TransactionHeaderType.Standard) {
            transaction.senderId = Address.fromPublicKey(transaction.senderPublicKey);
        } else {
            if (transactionAddresses?.senderId) {
                transaction.senderId = transactionAddresses.senderId;
                buf.jump(21);
            } else {
                transaction.senderId = Address.fromBuffer(buf.readBuffer(21));
            }
        }

        transaction.fee = BigNumber.make(buf.readBigUInt64LE().toString());
    }

    private static deserialiseMemo(transaction: ITransaction, buf: ByteBuffer): void {
        const memoLength: number = buf.readUInt8();
        if (memoLength > 0) {
            const memoBuffer: Buffer = buf.readBuffer(memoLength);
            transaction.data.memo = memoBuffer.toString("utf8");
        }
    }

    private static deserialiseSignatures(transaction: ITransactionData, buf: ByteBuffer): void {
        const canRead = () => {
            return buf.getRemainderLength() && buf.getRemainderLength() % 64 === 0;
        };

        if (canRead()) {
            transaction.signatures = { primary: buf.readBuffer(64).toString("hex") };
        }

        if (canRead()) {
            transaction.signatures!.extra = buf.readBuffer(64).toString("hex");
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

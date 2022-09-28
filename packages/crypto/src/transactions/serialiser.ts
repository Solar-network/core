import { TransactionHeaderType, TransactionTypeGroup } from "../enums";
import { AddressNetworkError, TransactionVersionError } from "../errors";
import { Address } from "../identities";
import { ISerialiseOptions } from "../interfaces";
import { ITransaction, ITransactionData } from "../interfaces";
import { configManager } from "../managers/config";
import { ByteBuffer, isSupportedTransactionVersion } from "../utils";
import { TransactionTypeFactory } from "./types";

export class Serialiser {
    public static getBytes(transaction: ITransactionData, options: ISerialiseOptions = {}): Buffer {
        const version: number = transaction.version || 1;

        if (options.acceptLegacyVersion || options.disableVersionCheck || isSupportedTransactionVersion(version)) {
            return this.serialise(TransactionTypeFactory.create(transaction), options);
        } else {
            throw new TransactionVersionError(version);
        }
    }

    /**
     * Serialises the given transaction
     */
    public static serialise(transaction: ITransaction, options: ISerialiseOptions = {}): Buffer {
        let size = 83886;
        const maxPayload = configManager.getMilestone(configManager.getHeight()).block?.maxPayload;
        const maxTransactions = configManager.getMilestone(configManager.getHeight()).block?.maxTransactions;

        if (maxPayload && maxTransactions) {
            size = Math.floor(maxPayload / maxTransactions) * 2;
        }

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(size));

        this.serialiseCommon(transaction.data, buf);
        this.serialiseMemo(transaction, buf);

        const serialised: ByteBuffer | undefined = transaction.serialise(options);

        if (!serialised) {
            throw new Error();
        }

        buf.writeBuffer(serialised.getResult());

        this.serialiseSignatures(transaction.data, buf, options);

        const bufferBuffer = buf.getResult();
        transaction.serialised = bufferBuffer;

        return bufferBuffer;
    }

    private static serialiseCommon(transaction: ITransactionData, buf: ByteBuffer): void {
        transaction.version = transaction.version || 0x03;
        transaction.headerType = transaction.headerType || 0x00;

        if (transaction.typeGroup === undefined) {
            transaction.typeGroup = TransactionTypeGroup.Core;
        }

        buf.writeUInt8(0xff - transaction.headerType);
        buf.writeUInt8(transaction.version);
        buf.writeUInt8(transaction.network || configManager.get("network.pubKeyHash"));

        buf.writeUInt32LE(transaction.typeGroup);
        buf.writeUInt16LE(transaction.type);
        buf.writeBigInt64LE(transaction.nonce.toBigInt());

        buf.writeBuffer(Buffer.from(transaction.senderPublicKey, "hex"));
        if (transaction.headerType === TransactionHeaderType.Extended) {
            const { addressBuffer, addressError } = Address.toBuffer(transaction.senderId);
            if (addressError) {
                throw new AddressNetworkError(addressError);
            }

            buf.writeBuffer(addressBuffer);
        }

        buf.writeBigInt64LE(transaction.fee.toBigInt());
    }

    private static serialiseMemo(transaction: ITransaction, buf: ByteBuffer): void {
        const { data }: ITransaction = transaction;

        if (data.memo) {
            const memo: Buffer = Buffer.from(data.memo, "utf8");
            buf.writeUInt8(memo.length);
            buf.writeBuffer(memo);
        } else {
            buf.writeUInt8(0x00);
        }
    }

    private static serialiseSignatures(
        transaction: ITransactionData,
        buf: ByteBuffer,
        options: ISerialiseOptions = {},
    ): void {
        if (transaction.signatures) {
            if (transaction.signatures.primary && !options.excludeSignature) {
                buf.writeBuffer(Buffer.from(transaction.signatures.primary, "hex"));
            }

            if (transaction.signatures.extra && !options.excludeExtraSignature) {
                buf.writeBuffer(Buffer.from(transaction.signatures.extra, "hex"));
            }
        }
    }
}

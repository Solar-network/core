import { TransactionHeaderType, TransactionType } from "../enums";
import { AddressNetworkError, TransactionVersionError } from "../errors";
import { Address } from "../identities";
import { ISerialiseOptions } from "../interfaces";
import { ITransaction, ITransactionData } from "../interfaces";
import { configManager } from "../managers/config";
import { ByteBuffer, isSupportedTransactionVersion, typeAndGroup } from "../utils";
import { TransactionTypeFactory } from "./types";

export class Serialiser {
    public static getBytes(transactionData: ITransactionData, options: ISerialiseOptions = {}): Buffer {
        const version: number = transactionData.version;

        if (options.acceptLegacyVersion || options.disableVersionCheck || isSupportedTransactionVersion(version)) {
            return this.serialise(TransactionTypeFactory.create(transactionData), options);
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

        if (options.index === undefined) {
            options.index = 0;
        }

        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(size));

        const internalType: string = this.serialiseCommon(transaction, buf, options.index);
        transaction.internalType = internalType;

        const serialised: ByteBuffer | undefined = transaction.serialise(options);

        if (!serialised) {
            throw new Error();
        }

        this.serialiseMemo(transaction, buf);

        buf.writeBuffer(serialised.getResult());

        this.serialiseSignatures(transaction, buf, options);

        const bufferBuffer = buf.getResult();
        transaction.serialised = bufferBuffer;
        return bufferBuffer;
    }

    private static serialiseCommon(transaction: ITransaction, buf: ByteBuffer, index: number = 0): string {
        const { data }: ITransaction = transaction;
        data.version = data.version || 0x03;
        data.headerType = data.headerType || 0x00;

        buf.writeUInt8(0xff - data.headerType);
        buf.writeUInt8(data.version);
        buf.writeUInt8(data.network || configManager.get("network.pubKeyHash"));

        const { type, group } = typeAndGroup(TransactionType[data.type][index ?? 0]);

        buf.writeUInt32LE(group);
        buf.writeUInt16LE(type);

        buf.writeBigInt64LE(data.nonce.toBigInt());

        buf.writeBuffer(Buffer.from(data.senderPublicKey, "hex"));
        if (data.headerType === TransactionHeaderType.Extended) {
            const { addressBuffer, addressError } = Address.toBuffer(data.senderId);
            if (addressError) {
                throw new AddressNetworkError(addressError);
            }

            buf.writeBuffer(addressBuffer);
        }

        buf.writeBigInt64LE(data.fee.toBigInt());

        return `${group}/${type}`;
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
        transaction: ITransaction,
        buf: ByteBuffer,
        options: ISerialiseOptions = {},
    ): void {
        const { data }: ITransaction = transaction;

        if (data.signatures) {
            if (data.signatures.primary && !options.excludeSignature) {
                buf.writeBuffer(Buffer.from(data.signatures.primary, "hex"));
            }

            if (data.signatures.extra && !options.excludeExtraSignature) {
                buf.writeBuffer(Buffer.from(data.signatures.extra, "hex"));
            }
        }
    }
}

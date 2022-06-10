import { TransactionTypeGroup } from "../enums";
import { TransactionVersionError } from "../errors";
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
        const buff: ByteBuffer = new ByteBuffer(
            Buffer.alloc(configManager.getMilestone(configManager.getHeight()).block?.maxPayload ?? 8192),
        );

        this.serialiseCommon(transaction.data, buff);
        this.serialiseVendorField(transaction, buff);

        const serialised: ByteBuffer | undefined = transaction.serialise(options);

        if (!serialised) {
            throw new Error();
        }

        buff.writeBuffer(serialised.getResult());

        this.serialiseSignatures(transaction.data, buff, options);

        const bufferBuffer = buff.getResult();
        transaction.serialised = bufferBuffer;

        return bufferBuffer;
    }

    private static serialiseCommon(transaction: ITransactionData, buff: ByteBuffer): void {
        transaction.version = transaction.version || 0x01;
        if (transaction.typeGroup === undefined) {
            transaction.typeGroup = TransactionTypeGroup.Core;
        }

        buff.writeUInt8(0xff);
        buff.writeUInt8(transaction.version);
        buff.writeUInt8(transaction.network || configManager.get("network.pubKeyHash"));
        buff.writeUInt32LE(transaction.typeGroup);
        buff.writeUInt16LE(transaction.type);

        if (transaction.nonce) {
            buff.writeBigInt64LE(transaction.nonce.toBigInt());
        }

        if (transaction.senderPublicKey) {
            buff.writeBuffer(Buffer.from(transaction.senderPublicKey, "hex"));
        }

        buff.writeBigInt64LE(transaction.fee.toBigInt());
    }

    private static serialiseVendorField(transaction: ITransaction, buff: ByteBuffer): void {
        const { data }: ITransaction = transaction;

        if (data.vendorField) {
            const vf: Buffer = Buffer.from(data.vendorField, "utf8");
            buff.writeUInt8(vf.length);
            buff.writeBuffer(vf);
        } else {
            buff.writeUInt8(0x00);
        }
    }

    private static serialiseSignatures(
        transaction: ITransactionData,
        buff: ByteBuffer,
        options: ISerialiseOptions = {},
    ): void {
        if (transaction.signature && !options.excludeSignature) {
            buff.writeBuffer(Buffer.from(transaction.signature, "hex"));
        }

        const secondSignature: string | undefined = transaction.secondSignature || transaction.signSignature;

        if (secondSignature && !options.excludeSecondSignature) {
            buff.writeBuffer(Buffer.from(secondSignature, "hex"));
        }

        if (transaction.signatures) {
            if (!options.excludeMultiSignature) {
                buff.writeBuffer(Buffer.from(transaction.signatures.join(""), "hex"));
            }
        }
    }
}
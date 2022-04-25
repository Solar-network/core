import { TransactionTypeGroup } from "../enums";
import { TransactionVersionError } from "../errors";
import { ISerializeOptions } from "../interfaces";
import { ITransaction, ITransactionData } from "../interfaces";
import { configManager } from "../managers/config";
import { ByteBuffer, isSupportedTransactionVersion } from "../utils";
import { TransactionTypeFactory } from "./types";

// Reference: https://github.com/ArkEcosystem/AIPs/blob/master/AIPS/aip-11.md
export class Serializer {
    public static getBytes(transaction: ITransactionData, options: ISerializeOptions = {}): Buffer {
        const version: number = transaction.version || 1;

        if (options.acceptLegacyVersion || options.disableVersionCheck || isSupportedTransactionVersion(version)) {
            return this.serialize(TransactionTypeFactory.create(transaction), options);
        } else {
            throw new TransactionVersionError(version);
        }
    }

    /**
     * Serializes the given transaction
     */
    public static serialize(transaction: ITransaction, options: ISerializeOptions = {}): Buffer {
        const buff: ByteBuffer = new ByteBuffer(
            Buffer.alloc(configManager.getMilestone(configManager.getHeight()).block?.maxPayload ?? 8192),
        );

        this.serializeCommon(transaction.data, buff);
        this.serializeVendorField(transaction, buff);

        const serialized: ByteBuffer | undefined = transaction.serialize(options);

        if (!serialized) {
            throw new Error();
        }

        buff.writeBuffer(serialized.getResult());

        this.serializeSignatures(transaction.data, buff, options);

        const bufferBuffer = buff.getResult();
        transaction.serialized = bufferBuffer;

        return bufferBuffer;
    }

    private static serializeCommon(transaction: ITransactionData, buff: ByteBuffer): void {
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

    private static serializeVendorField(transaction: ITransaction, buff: ByteBuffer): void {
        const { data }: ITransaction = transaction;

        if (data.vendorField) {
            const vf: Buffer = Buffer.from(data.vendorField, "utf8");
            buff.writeUInt8(vf.length);
            buff.writeBuffer(vf);
        } else {
            buff.writeUInt8(0x00);
        }
    }

    private static serializeSignatures(
        transaction: ITransactionData,
        buff: ByteBuffer,
        options: ISerializeOptions = {},
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

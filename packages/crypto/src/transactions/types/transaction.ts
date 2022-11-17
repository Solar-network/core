import { NotImplemented } from "../../errors";
import {
    IDeserialiseAddresses,
    ISchemaValidationResult,
    ISerialiseOptions,
    ITransaction,
    ITransactionData,
    ITransactionJson,
} from "../../interfaces";
import { configManager } from "../../managers/config";
import { BigNumber, ByteBuffer } from "../../utils";
import { Verifier } from "../verifier";
import { TransactionSchema } from "./schemas";

export abstract class Transaction implements ITransaction {
    public static emoji: string;
    public static key: string;

    public static unique: boolean = false;

    public internalType!: string;
    public isVerified: boolean = false;
    public data!: ITransactionData;
    public serialised!: Buffer;
    public timestamp!: number;

    public get addresses(): IDeserialiseAddresses {
        return {
            senderId: this.data.senderId,
        };
    }

    public get emoji(): string {
        return this.emoji;
    }

    public get id(): string | undefined {
        return this.data.id;
    }

    public get verified(): boolean {
        return this.isVerified;
    }

    public get key(): string {
        return (this as any).__proto__.constructor.key;
    }

    public static getSchema(): TransactionSchema {
        throw new NotImplemented();
    }

    public setBurnedFee(height: number): void {
        const milestone = configManager.getMilestone(height);

        this.data.burnedFee = BigNumber.ZERO;
        if (typeof milestone.burn === "object" && typeof milestone.burn.feePercent === "number") {
            const feePercent = parseInt(milestone.burn.feePercent);
            if (feePercent >= 0 && feePercent <= 100) {
                this.data.burnedFee = this.data.fee.times(feePercent).dividedBy(100);
            }
        }
    }

    public verify(options?: ISerialiseOptions): { transaction: ITransaction; verified: boolean } {
        return {
            transaction: this,
            verified: Verifier.verify(this.data, options),
        };
    }

    public verifyExtraSignature(publicKey: string): boolean {
        return Verifier.verifyExtraSignature(this, publicKey);
    }

    public verifySchema(): ISchemaValidationResult {
        return Verifier.verifySchema(this.data);
    }

    public toJson(): ITransactionJson {
        const data: ITransactionJson = JSON.parse(JSON.stringify(this.data));

        return data;
    }

    public toString(): string {
        const parts: string[] = [];

        if (this.data.senderId && this.data.nonce) {
            parts.push(`${this.data.senderId}#${this.data.nonce}`);
        } else if (this.data.senderId) {
            parts.push(this.data.senderId);
        }

        if (this.data.id) {
            parts.push(this.data.id.slice(-8));
        }

        parts.push(`${this.key[0].toUpperCase()}${this.key.slice(1)} v${this.data.version}`);

        return parts.join(" ");
    }

    public abstract serialise(): ByteBuffer | undefined;
    public abstract deserialise(buf: ByteBuffer): void;
}

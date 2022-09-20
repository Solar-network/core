import { TransactionTypeGroup } from "../../enums";
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
    public static type: number;
    public static typeGroup: number;
    public static unique: boolean = false;

    protected static defaultStaticFee: BigNumber = BigNumber.ZERO;

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

    public get type(): number {
        return this.data.type;
    }

    public get typeGroup(): number | undefined {
        return this.data.typeGroup;
    }

    public get verified(): boolean {
        return this.isVerified;
    }

    public get key(): string {
        return (this as any).__proto__.constructor.key;
    }

    public get staticFee(): BigNumber {
        return (this as any).__proto__.constructor.staticFee({ data: this.data });
    }

    public static getSchema(): TransactionSchema {
        throw new NotImplemented();
    }

    public static staticFee(feeContext: { height?: number; data?: ITransactionData } = {}): BigNumber {
        const milestones = configManager.getMilestone(feeContext.height);
        if (milestones.fees && milestones.fees.staticFees && this.key) {
            const fee: any = milestones.fees.staticFees[this.key];

            if (fee !== undefined) {
                return BigNumber.make(fee);
            }
        }

        return this.defaultStaticFee;
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

    public verify(options?: ISerialiseOptions): boolean {
        return Verifier.verify(this.data, options);
    }

    public verifyExtraSignature(publicKey: string): boolean {
        return Verifier.verifyExtraSignature(this.data, publicKey);
    }

    public verifySchema(): ISchemaValidationResult {
        return Verifier.verifySchema(this.data);
    }

    public toJson(): ITransactionJson {
        const data: ITransactionJson = JSON.parse(JSON.stringify(this.data));

        if (data.typeGroup === TransactionTypeGroup.Core) {
            delete data.typeGroup;
        }

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

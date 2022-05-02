import { TransactionTypeGroup } from "../../enums";

export class InternalTransactionType {
    private static types: Map<string, InternalTransactionType> = new Map();

    private constructor(public readonly type: number, public readonly typeGroup: number) {}

    public static from(type: number, typeGroup?: number): InternalTransactionType {
        if (typeGroup === undefined) {
            typeGroup = TransactionTypeGroup.Core;
        }

        const compositeType = `${typeGroup}-${type}`;
        if (!this.types.has(compositeType)) {
            this.types.set(compositeType, new InternalTransactionType(type, typeGroup));
        }

        return this.types.get(compositeType)!;
    }

    public toString(): string {
        switch (this.typeGroup) {
            case TransactionTypeGroup.Core: {
                return `Core/${this.type}`;
            }
            case TransactionTypeGroup.Reserved: {
                return `Reserved/${this.type}`;
            }
            case TransactionTypeGroup.Solar: {
                return `Solar/${this.type}`;
            }
            case TransactionTypeGroup.Test: {
                return `Test/${this.type}`;
            }
        }

        return `${this.typeGroup}/${this.type}`;
    }
}

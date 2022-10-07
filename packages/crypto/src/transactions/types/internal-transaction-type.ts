export class InternalTransactionType {
    private static types: Map<string, InternalTransactionType> = new Map();
    private static typeNames: Map<string, InternalTransactionType> = new Map();

    private constructor(public readonly type: number, public readonly group: number, public readonly key?: string) {}

    public static fromKey(type: string): InternalTransactionType {
        return this.typeNames.get(type)!;
    }

    public static from(type: number, group?: number, key?: string): InternalTransactionType {
        group = group ?? 1;
        const compositeType = `${group}/${type}`;
        if (!this.types.has(compositeType)) {
            const internalTransactionType: InternalTransactionType = new InternalTransactionType(type, group, key);
            this.types.set(compositeType, internalTransactionType);
            if (key) {
                this.typeNames.set(key, internalTransactionType);
            }
        }

        return this.types.get(compositeType)!;
    }

    public toString(): string {
        return `${this.group}/${this.type}`;
    }
}

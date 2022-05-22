import { UnknownTransactionError } from "../../errors";
import { ITransaction, ITransactionData } from "../../interfaces";
import { InternalTransactionType } from "./internal-transaction-type";
import { Transaction } from "./transaction";

type TransactionConstructor = typeof Transaction;

export class TransactionTypeFactory {
    private static transactionTypes: Map<InternalTransactionType, TransactionConstructor>;

    public static initialize(transactionTypes: Map<InternalTransactionType, TransactionConstructor>): void {
        this.transactionTypes = transactionTypes;
    }

    public static create(data: ITransactionData): ITransaction {
        const instance: ITransaction = new (this.get(data.type, data.typeGroup, data.version) as any)() as ITransaction;
        instance.data = data;
        instance.data.version = data.version || 3;

        return instance;
    }

    public static get(type: number, typeGroup?: number, version?: number): TransactionConstructor | undefined {
        const internalType: InternalTransactionType = InternalTransactionType.from(type, typeGroup);

        if (!this.transactionTypes.has(internalType)) {
            throw new UnknownTransactionError(internalType.toString());
        }

        return this.transactionTypes.get(internalType);
    }
}

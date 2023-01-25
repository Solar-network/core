import { TransactionType } from "../enums";
import { UnknownTransactionError } from "../errors";
import { typeAndGroup } from "../utils";
import { validator } from "../validation";
import {
    BurnTransaction,
    ExtraSignatureRegistrationTransaction,
    IpfsTransaction,
    RegistrationTransaction,
    ResignationTransaction,
    Transaction,
    TransactionTypeFactory,
    TransferTransaction,
    VoteTransaction,
} from "./types";
import { InternalTransactionType } from "./types/internal-transaction-type";

export type TransactionConstructor = typeof Transaction;

class TransactionRegistry {
    private readonly transactionTypes: Map<InternalTransactionType, TransactionConstructor> = new Map();

    public constructor() {
        TransactionTypeFactory.initialise(this.transactionTypes);

        this.registerTransactionType(ExtraSignatureRegistrationTransaction);
        this.registerTransactionType(RegistrationTransaction);
        this.registerTransactionType(IpfsTransaction);
        this.registerTransactionType(TransferTransaction);
        this.registerTransactionType(ResignationTransaction);
        this.registerTransactionType(BurnTransaction);
        this.registerTransactionType(VoteTransaction);
    }

    public registerTransactionType(constructor: TransactionConstructor): void {
        const { key } = constructor;

        if (typeof key === "undefined") {
            throw new Error();
        }

        for (const txType of TransactionType[key]) {
            const { type, group } = typeAndGroup(txType);

            const internalType: InternalTransactionType = InternalTransactionType.from(type, group, key);

            if (!this.transactionTypes.has(internalType)) {
                this.transactionTypes.set(internalType, constructor);
                this.updateSchemas(constructor);
            }
        }
    }

    public deregisterTransactionType(constructor: TransactionConstructor): void {
        const { key } = constructor;

        if (typeof key === "undefined") {
            throw new Error();
        }

        for (const txType of TransactionType[key]) {
            const { type, group } = typeAndGroup(txType);

            const internalType: InternalTransactionType = InternalTransactionType.from(type, group, key);

            if (!this.transactionTypes.has(internalType)) {
                throw new UnknownTransactionError(internalType.toString());
            }

            this.updateSchemas(constructor, true);

            this.transactionTypes.delete(internalType);
        }
    }

    private updateSchemas(transaction: TransactionConstructor, remove?: boolean): void {
        validator.extendTransaction(transaction.getSchema(), remove);
    }
}

export const transactionRegistry = new TransactionRegistry();

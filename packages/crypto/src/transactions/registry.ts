import {
    TransactionAlreadyRegisteredError,
    TransactionKeyAlreadyRegisteredError,
    UnknownTransactionError,
} from "../errors";
import { validator } from "../validation";
import { Core, Solar, Transaction, TransactionTypeFactory } from "./types";
import { InternalTransactionType } from "./types/internal-transaction-type";

export type TransactionConstructor = typeof Transaction;

class TransactionRegistry {
    private readonly transactionTypes: Map<InternalTransactionType, TransactionConstructor> = new Map();

    public constructor() {
        TransactionTypeFactory.initialise(this.transactionTypes);

        // Core transactions
        this.registerTransactionType(Core.LegacyTransferTransaction);
        this.registerTransactionType(Core.SecondSignatureRegistrationTransaction);
        this.registerTransactionType(Core.DelegateRegistrationTransaction);
        this.registerTransactionType(Core.LegacyVoteTransaction);
        this.registerTransactionType(Core.MultiSignatureRegistrationTransaction);
        this.registerTransactionType(Core.IpfsTransaction);
        this.registerTransactionType(Core.TransferTransaction);
        this.registerTransactionType(Core.DelegateResignationTransaction);
        this.registerTransactionType(Core.HtlcLockTransaction);
        this.registerTransactionType(Core.HtlcClaimTransaction);
        this.registerTransactionType(Core.HtlcRefundTransaction);

        // Solar transactions
        this.registerTransactionType(Solar.BurnTransaction);
        this.registerTransactionType(Solar.VoteTransaction);
    }

    public registerTransactionType(constructor: TransactionConstructor): void {
        const { typeGroup, type } = constructor;

        if (typeof type === "undefined" || typeof typeGroup === "undefined") {
            throw new Error();
        }

        const internalType: InternalTransactionType = InternalTransactionType.from(type, typeGroup);

        if (this.transactionTypes.has(internalType)) {
            const registeredConstructor = this.transactionTypes.get(internalType);
            if (registeredConstructor === constructor) {
                throw new TransactionAlreadyRegisteredError(constructor.name);
            }
            throw new TransactionKeyAlreadyRegisteredError(registeredConstructor!.name);
        }

        this.transactionTypes.set(internalType, constructor);
        this.updateSchemas(constructor);
    }

    public deregisterTransactionType(constructor: TransactionConstructor): void {
        const { typeGroup, type } = constructor;

        if (typeof type === "undefined" || typeof typeGroup === "undefined") {
            throw new Error();
        }

        const internalType: InternalTransactionType = InternalTransactionType.from(type, typeGroup);
        if (!this.transactionTypes.has(internalType)) {
            throw new UnknownTransactionError(internalType.toString());
        }

        this.updateSchemas(constructor, true);

        this.transactionTypes.delete(internalType);
    }

    private updateSchemas(transaction: TransactionConstructor, remove?: boolean): void {
        validator.extendTransaction(transaction.getSchema(), remove);
    }
}

export const transactionRegistry = new TransactionRegistry();

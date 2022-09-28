import { CoreTransactionType, TransactionTypeGroup } from "../enums";
import { InvalidTransactionBytesError, TransactionSchemaError, TransactionVersionError } from "../errors";
import {
    IDeserialiseAddresses,
    IDeserialiseOptions,
    ISerialiseOptions,
    ITransaction,
    ITransactionData,
    ITransactionJson,
} from "../interfaces";
import { BigNumber, isException } from "../utils";
import { Deserialiser } from "./deserialiser";
import { Serialiser } from "./serialiser";
import { TransactionTypeFactory } from "./types";
import { Utils } from "./utils";
import { Verifier } from "./verifier";

export class TransactionFactory {
    public static fromHex(hex: string): ITransaction {
        return this.fromSerialised(hex);
    }

    public static fromBytes(buf: Buffer, strict = true, options: IDeserialiseOptions = {}): ITransaction {
        return this.fromSerialised(buf.toString("hex"), strict, options);
    }

    /**
     * Deserialises a transaction from `buffer` with the given `id`. It is faster
     * than `fromBytes` at the cost of vital safety checks (validation, verification and id calculation).
     *
     * NOTE: Only use this internally when it is safe to assume the buffer has already been
     * verified.
     */
    public static fromBytesUnsafe(
        buf: Buffer,
        id?: string,
        transactionAddresses?: IDeserialiseAddresses,
    ): ITransaction {
        try {
            const options: IDeserialiseOptions | ISerialiseOptions = {
                acceptLegacyVersion: true,
                transactionAddresses,
            };
            const transaction = Deserialiser.deserialise(buf, options);
            transaction.data.id = id || Utils.getId(transaction.data, options);
            transaction.isVerified = true;

            return transaction;
        } catch (error) {
            throw new InvalidTransactionBytesError(error.message);
        }
    }

    public static fromJson(json: ITransactionJson): ITransaction {
        const data: ITransactionData = { ...json } as unknown as ITransactionData;
        if (data.amount) {
            data.amount = BigNumber.make(data.amount);
        }
        data.fee = BigNumber.make(data.fee);

        return this.fromData(data);
    }

    public static fromData(data: ITransactionData, strict = true, options: IDeserialiseOptions = {}): ITransaction {
        if (data.typeGroup === TransactionTypeGroup.Core && data.type === CoreTransactionType.Transfer) {
            if (data.asset && data.asset.payments && !data.asset.transfers) {
                data.asset.transfers = data.asset.payments;
                delete data.asset.payments;
            }
        }

        if (data.signature) {
            data.signatures = { primary: data.signature };
        }
        if (data.signatures && data.secondSignature) {
            data.signatures.extra = data.secondSignature;
        }

        const { value, error } = Verifier.verifySchema(data, strict);

        if (error && !isException(value)) {
            throw new TransactionSchemaError(error);
        }

        const transaction: ITransaction = TransactionTypeFactory.create(value);

        Serialiser.serialise(transaction);

        return this.fromBytes(transaction.serialised, strict, options);
    }

    private static fromSerialised(serialised: string, strict = true, options: IDeserialiseOptions = {}): ITransaction {
        try {
            const transaction = Deserialiser.deserialise(serialised, options);
            transaction.data.id = Utils.getId(transaction.data, options);

            const { value, error } = Verifier.verifySchema(transaction.data, strict);

            if (error && !isException(value)) {
                throw new TransactionSchemaError(error);
            }

            transaction.isVerified = transaction.verify(options);

            return transaction;
        } catch (error) {
            if (error instanceof TransactionVersionError || error instanceof TransactionSchemaError) {
                throw error;
            }

            throw new InvalidTransactionBytesError(error.message);
        }
    }
}

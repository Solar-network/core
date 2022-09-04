import { HashAlgorithms } from "../crypto";
import { AddressNetworkError } from "../errors";
import { ISerialiseOptions, ITransactionData } from "../interfaces";
import { isException } from "../utils";
import { Serialiser } from "./serialiser";
import { TransactionTypeFactory } from "./types/factory";

export class Utils {
    public static toBytes(data: ITransactionData): Buffer {
        return Serialiser.serialise(TransactionTypeFactory.create(data));
    }

    public static toHash(transaction: ITransactionData, options?: ISerialiseOptions): Buffer {
        return HashAlgorithms.sha256(Serialiser.getBytes(transaction, options));
    }

    public static getId(transaction: ITransactionData, options: ISerialiseOptions = {}): string {
        const id: string = Utils.toHash(transaction, options).toString("hex");

        if (options.addressError && !isException({ id })) {
            throw new AddressNetworkError(options.addressError);
        }

        return id;
    }
}

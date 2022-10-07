import { HashAlgorithms } from "../crypto";
import { AddressNetworkError } from "../errors";
import { ISerialiseOptions, ITransactionData } from "../interfaces";
import { isException } from "../utils";
import { Serialiser } from "./serialiser";

export class Utils {
    public static toHash(transactionData: ITransactionData, options?: ISerialiseOptions): Buffer {
        return HashAlgorithms.sha256(Serialiser.getBytes(transactionData, options));
    }

    public static getId(transactionData: ITransactionData, options: ISerialiseOptions = {}): string {
        const id: string = Utils.toHash(transactionData, options).toString("hex");

        if (options.addressError && !isException({ id })) {
            throw new AddressNetworkError(options.addressError);
        }

        return id;
    }
}

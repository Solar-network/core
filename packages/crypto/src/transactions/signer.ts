import { Hash } from "../crypto";
import { IKeyPair, ISerialiseOptions, ITransactionData } from "../interfaces";
import { Utils } from "./utils";

export class Signer {
    public static sign(transaction: ITransactionData, keys: IKeyPair, options?: ISerialiseOptions): string {
        if (!options || (options.excludeSignature === undefined && options.excludeExtraSignature === undefined)) {
            options = { excludeSignature: true, excludeExtraSignature: true, ...options };
        }

        const hash: Buffer = Utils.toHash(transaction, options);
        const signature: string = Hash.signSchnorr(hash, keys, transaction.version > 2);

        if (!transaction.signatures) {
            transaction.signatures = {};
        }
        transaction.signatures.primary = signature;

        return signature;
    }

    public static extraSign(transaction: ITransactionData, keys: IKeyPair): string {
        const hash: Buffer = Utils.toHash(transaction, { excludeExtraSignature: true });
        const signature: string = Hash.signSchnorr(hash, keys, transaction.version > 2);

        if (!transaction.signatures) {
            transaction.signatures = {};
        }
        transaction.signatures.extra = signature;

        return signature;
    }
}

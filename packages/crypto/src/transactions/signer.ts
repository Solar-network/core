import { Hash } from "../crypto";
import { IKeyPair, ISerialiseOptions, ITransactionData } from "../interfaces";
import { Utils } from "./utils";

export class Signer {
    public static sign(transactionData: ITransactionData, keys: IKeyPair, options?: ISerialiseOptions): string {
        if (!options || (options.excludeSignature === undefined && options.excludeExtraSignature === undefined)) {
            options = { excludeSignature: true, excludeExtraSignature: true, ...options };
        }

        const hash: Buffer = Utils.toHash(transactionData, options);
        const signature: string = Hash.signSchnorr(hash, keys);

        if (!transactionData.signatures) {
            transactionData.signatures = {};
        }
        transactionData.signatures.primary = signature;

        return signature;
    }

    public static extraSign(transactionData: ITransactionData, keys: IKeyPair): string {
        const hash: Buffer = Utils.toHash(transactionData, { excludeExtraSignature: true });
        const signature: string = Hash.signSchnorr(hash, keys);

        if (!transactionData.signatures) {
            transactionData.signatures = {};
        }
        transactionData.signatures.extra = signature;

        return signature;
    }
}

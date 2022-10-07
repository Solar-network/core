import { Hash } from "../crypto/hash";
import { ISchemaValidationResult, ITransactionData, IVerifyOptions } from "../interfaces";
import { isException } from "../utils";
import { validator } from "../validation";
import { TransactionTypeFactory } from "./types/factory";
import { Utils } from "./utils";

export class Verifier {
    public static verify(data: ITransactionData, options?: IVerifyOptions): boolean {
        if (isException(data)) {
            return true;
        }

        return Verifier.verifyHash(data, options?.disableVersionCheck);
    }

    public static verifyExtraSignature(
        transaction: ITransactionData,
        publicKey: string,
        options?: IVerifyOptions,
    ): boolean {
        if (!transaction.signatures || !transaction.signatures.extra) {
            return false;
        }

        const hash: Buffer = Utils.toHash(transaction, {
            disableVersionCheck: options?.disableVersionCheck,
            excludeExtraSignature: true,
        });
        return this.internalVerifySignature(hash, transaction.signatures.extra, publicKey, transaction.version > 2);
    }

    public static verifyHash(data: ITransactionData, disableVersionCheck = false): boolean {
        const { signatures, senderPublicKey } = data;

        if (!signatures || !signatures.primary || !senderPublicKey) {
            return false;
        }

        const hash: Buffer = Utils.toHash(data, {
            disableVersionCheck,
            excludeSignature: true,
            excludeExtraSignature: true,
        });

        return this.internalVerifySignature(hash, signatures.primary, senderPublicKey, data.version > 2);
    }

    public static verifySchema(data: ITransactionData, strict = true): ISchemaValidationResult {
        const transactionType = TransactionTypeFactory.get(data.type, data.typeGroup);

        if (!transactionType) {
            throw new Error();
        }

        const { $id } = transactionType.getSchema();

        return validator.validate(strict ? `${$id}Strict` : `${$id}`, data);
    }

    private static internalVerifySignature(
        hash: Buffer,
        signature: string,
        publicKey: string,
        bip340: boolean,
    ): boolean {
        return Hash.verifySchnorr(hash, signature, publicKey, bip340);
    }
}

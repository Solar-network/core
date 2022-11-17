import { Hash } from "../crypto/hash";
import { TransactionType } from "../enums";
import { ISchemaValidationResult, ITransaction, ITransactionData, IVerifyOptions } from "../interfaces";
import { isException } from "../utils";
import { validator } from "../validation";
import { TransactionTypeFactory } from "./types/factory";
import { Utils } from "./utils";

export class Verifier {
    public static verify(data: ITransactionData, options?: IVerifyOptions): boolean {
        if (isException(data)) {
            return true;
        }
        return Verifier.verifyHash(data, options);
    }

    public static verifyExtraSignature(
        transaction: ITransaction,
        publicKey: string,
        options?: IVerifyOptions,
    ): boolean {
        if (!transaction.data.signatures || !transaction.data.signatures.extra) {
            return false;
        }

        const index: number = TransactionType[transaction.data.type].findIndex(
            (id: string) => id === transaction.internalType,
        );

        const hash: Buffer = Utils.toHash(transaction.data, {
            ...options,
            excludeExtraSignature: true,
            index,
        });

        return this.internalVerifySignature(hash, transaction.data.signatures.extra, publicKey, [
            transaction.data.version,
        ]);
    }

    public static verifyHash(data: ITransactionData, options: IVerifyOptions = {}): boolean {
        const { signatures, senderPublicKey } = data;

        if (!signatures || !signatures.primary || !senderPublicKey) {
            return false;
        }

        const hash: Buffer = Utils.toHash(data, {
            ...options,
            excludeSignature: true,
            excludeExtraSignature: true,
        });

        return this.internalVerifySignature(hash, signatures.primary, senderPublicKey, [data.version]);
    }

    public static verifySchema(data: ITransactionData, strict = true): ISchemaValidationResult {
        const transactionType = TransactionTypeFactory.get(data.type);

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
        transactionVersions: number[],
    ): boolean {
        return Hash.verifySchnorr(hash, signature, publicKey, transactionVersions);
    }
}

import { Hash } from "../crypto/hash";
import { DuplicateParticipantInMultiSignatureError, InvalidMultiSignatureAssetError } from "../errors";
import { IMultiSignatureAsset, ISchemaValidationResult, ITransactionData, IVerifyOptions } from "../interfaces";
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

    public static verifySecondSignature(
        transaction: ITransactionData,
        publicKey: string,
        options?: IVerifyOptions,
    ): boolean {
        const secondSignature: string | undefined = transaction.secondSignature || transaction.signSignature;

        if (!secondSignature) {
            return false;
        }

        const hash: Buffer = Utils.toHash(transaction, {
            disableVersionCheck: options?.disableVersionCheck,
            excludeSecondSignature: true,
        });
        return this.internalVerifySignature(hash, secondSignature, publicKey, transaction.version > 2);
    }

    public static verifySignatures(transaction: ITransactionData, multiSignature: IMultiSignatureAsset): boolean {
        if (!multiSignature) {
            throw new InvalidMultiSignatureAssetError();
        }

        const { publicKeys, min }: IMultiSignatureAsset = multiSignature;
        const { signatures }: ITransactionData = transaction;

        const hash: Buffer = Utils.toHash(transaction, {
            excludeSignature: true,
            excludeSecondSignature: true,
            excludeMultiSignature: true,
        });

        const publicKeyIndexes: { [index: number]: boolean } = {};
        let verified: boolean = false;
        let verifiedSignatures: number = 0;

        if (signatures) {
            for (let i = 0; i < signatures.length; i++) {
                const signature: string = signatures[i];
                const publicKeyIndex: number = parseInt(signature.slice(0, 2), 16);

                if (!publicKeyIndexes[publicKeyIndex]) {
                    publicKeyIndexes[publicKeyIndex] = true;
                } else {
                    throw new DuplicateParticipantInMultiSignatureError();
                }

                const partialSignature: string = signature.slice(2, 130);
                const publicKey: string = publicKeys[publicKeyIndex];

                if (Hash.verifySchnorr(hash, partialSignature, publicKey, transaction.version > 2)) {
                    verifiedSignatures++;
                }

                if (verifiedSignatures === min) {
                    verified = true;
                    break;
                } else if (signatures.length - (i + 1 - verifiedSignatures) < min) {
                    break;
                }
            }
        }

        return verified;
    }

    public static verifyHash(data: ITransactionData, disableVersionCheck = false): boolean {
        const { signature, senderPublicKey } = data;

        if (!signature || !senderPublicKey) {
            return false;
        }

        const hash: Buffer = Utils.toHash(data, {
            disableVersionCheck,
            excludeSignature: true,
            excludeSecondSignature: true,
        });

        return this.internalVerifySignature(hash, signature, senderPublicKey, data.version > 2);
    }

    public static verifySchema(data: ITransactionData, strict = true): ISchemaValidationResult {
        const transactionType = TransactionTypeFactory.get(data.type, data.typeGroup, data.version);

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

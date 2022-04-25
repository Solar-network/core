import { schnorr, secp256k1 } from "bcrypto";

import { IKeyPair } from "../interfaces";
import { HashAlgorithms } from "./hash-algorithms";

export class Hash {
    public static signSchnorr(hash: Buffer, keys: IKeyPair, bip340?: boolean): string {
        if (!bip340) {
            return Hash.signSchnorrLegacy(hash, keys);
        }

        return Hash.signSchnorrBip340(hash, keys);
    }

    public static verifySchnorr(
        hash: Buffer,
        signature: Buffer | string,
        publicKey: Buffer | string,
        bip340?: boolean,
    ): boolean {
        if (!bip340) {
            return Hash.verifySchnorrLegacy(hash, signature, publicKey);
        }

        return Hash.verifySchnorrBip340(hash, signature, publicKey);
    }

    public static signSchnorrLegacy(hash: Buffer, keys: IKeyPair): string {
        return secp256k1.schnorrSign(hash, Buffer.from(keys.privateKey, "hex")).toString("hex");
    }

    public static verifySchnorrLegacy(hash: Buffer, signature: Buffer | string, publicKey: Buffer | string): boolean {
        return secp256k1.schnorrVerify(
            hash,
            signature instanceof Buffer ? signature : Buffer.from(signature, "hex"),
            publicKey instanceof Buffer ? publicKey : Buffer.from(publicKey, "hex"),
        );
    }

    public static signSchnorrBip340(hash: Buffer, keys: IKeyPair): string {
        const digest: Buffer = hash.length !== 32 ? HashAlgorithms.sha256(hash) : hash;

        return schnorr.sign(digest, Buffer.from(keys.privateKey, "hex")).toString("hex");
    }

    public static verifySchnorrBip340(hash: Buffer, signature: Buffer | string, publicKey: Buffer | string): boolean {
        const digest: Buffer = hash.length !== 32 ? HashAlgorithms.sha256(hash) : hash;
        let key: Buffer = publicKey instanceof Buffer ? publicKey : Buffer.from(publicKey, "hex");
        if (key.length === 33) {
            key = key.slice(1);
        }

        return schnorr.verify(digest, signature instanceof Buffer ? signature : Buffer.from(signature, "hex"), key);
    }
}

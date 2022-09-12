import { secp256k1 } from "bcrypto";

import { NetworkType } from "../types";
import { Keys } from "./keys";

export class PublicKey {
    public static fromMnemonic(mnemonic: string): string {
        return Keys.fromMnemonic(mnemonic).publicKey.secp256k1;
    }

    public static fromWIF(wif: string, network?: NetworkType): string {
        return Keys.fromWIF(wif, network).publicKey.secp256k1;
    }

    public static verify(publicKey: string): boolean {
        return secp256k1.publicKeyVerify(Buffer.from(publicKey, "hex"));
    }
}

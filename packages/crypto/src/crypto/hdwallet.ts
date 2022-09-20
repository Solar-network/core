import * as bls from "@noble/bls12-381";
import { HDKey } from "@scure/bip32";
import { secp256k1 } from "bcrypto";
import { mnemonicToSeedSync } from "bip39";

import { IKeyPair } from "../interfaces";
import { configManager } from "../managers";

export class HDWallet {
    /**
     * Get root node from the given mnemonic.
     */
    public static fromMnemonic(mnemonic: string, account: number, slip44?: number): HDKey {
        if (slip44 === undefined) {
            slip44 = configManager.get("network.slip44");
        }
        return HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(`m/44'/${slip44}'/${account}'/0`);
    }

    /**
     * Get key pair from the given root, optionally at the specified index.
     */
    public static getKeys(root: HDKey, index?: number): IKeyPair {
        let node: HDKey = root;

        if (index !== undefined) {
            node = root.deriveChild(index);
        }

        if (!node.privateKey || !node.publicKey) {
            throw new Error();
        }

        const privateKey: Buffer = Buffer.from(node.privateKey);

        return {
            publicKey: {
                secp256k1: secp256k1.publicKeyCreate(privateKey, true).toString("hex"),
                bls12381: Buffer.from(bls.getPublicKey(privateKey)).toString("hex"),
            },
            privateKey: Buffer.from(node.privateKey).toString("hex"),
            compressed: true,
        };
    }
}

import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "bip39";

import { IKeyPair } from "../interfaces";
import { configManager } from "../managers";

export class HDWallet {
    /**
     * Get root node from the given mnemonic with an optional passphrase.
     */
    public static fromMnemonic(mnemonic: string, account: number, passphrase?: string): HDKey {
        return HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic, passphrase)).derive(
            `m/44'/${configManager.get("network.slip44")}'/${account}'/0`,
        );
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

        return {
            publicKey: Buffer.from(
                node.publicKey.buffer,
                node.publicKey.byteOffset,
                node.publicKey.byteLength,
            ).toString("hex"),
            privateKey: Buffer.from(
                node.privateKey.buffer,
                node.privateKey.byteOffset,
                node.privateKey.byteLength,
            ).toString("hex"),
            compressed: true,
        };
    }
}

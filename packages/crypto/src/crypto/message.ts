import { Keys } from "../identities";
import { IKeyPair, IMessage } from "../interfaces";
import { Network } from "../interfaces/networks";
import { configManager } from "../managers";
import { Hash } from "./hash";
import { HashAlgorithms } from "./hash-algorithms";

export class Message {
    public static sign(message: string, passphrase: string): IMessage {
        const keys: IKeyPair = Keys.fromPassphrase(passphrase);

        return {
            publicKey: keys.publicKey.secp256k1,
            signature: Hash.signSchnorr(this.createHash(message), keys, true),
            message,
        };
    }

    public static signWithWif(message: string, wif: string, network?: Network): IMessage {
        if (!network) {
            network = configManager.get("network");
        }

        const keys: IKeyPair = Keys.fromWIF(wif, network);

        return {
            publicKey: keys.publicKey.secp256k1,
            signature: Hash.signSchnorr(this.createHash(message), keys, true),
            message,
        };
    }

    public static verify({ message, publicKey, signature }: IMessage): boolean {
        return Hash.verifySchnorr(this.createHash(message), signature, publicKey, true);
    }

    private static createHash(message: string): Buffer {
        return HashAlgorithms.sha256(message);
    }
}

import wif from "wif";

import { IKeyPair } from "../interfaces";
import { Network } from "../interfaces/networks";
import { configManager } from "../managers";
import { Keys } from "./keys";

export class WIF {
    public static fromPassphrase(passphrase: string, network?: Network): string {
        const keys: IKeyPair = Keys.fromPassphrase(passphrase);

        if (!network) {
            network = configManager.get("network");
        }

        if (!network) {
            throw new Error();
        }

        return wif.encode(network.wif, Buffer.from(keys.privateKey, "hex"), keys.compressed);
    }

    public static fromKeys(keys: IKeyPair, network?: Network): string {
        if (!network) {
            network = configManager.get("network");
        }

        if (!network) {
            throw new Error();
        }

        return wif.encode(network.wif, Buffer.from(keys.privateKey, "hex"), keys.compressed);
    }
}

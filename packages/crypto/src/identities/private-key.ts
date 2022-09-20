import { NetworkType } from "../types";
import { Keys } from "./keys";

export class PrivateKey {
    public static fromMnemonic(mnemonic: string): string {
        return Keys.fromMnemonic(mnemonic).privateKey;
    }

    public static fromWIF(wif: string, network?: NetworkType): string {
        return Keys.fromWIF(wif, network).privateKey;
    }
}

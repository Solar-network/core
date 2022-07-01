import { Delegate } from "./interfaces";
import { BIP39 } from "./methods/bip39";

/**
 * @export
 * @class DelegateFactory
 */
export class DelegateFactory {
    /**
     * @static
     * @param {string} passphrase
     * @returns {Delegate}
     * @memberof DelegateFactory
     */
    public static fromBIP39(passphrase: string): Delegate {
        return new BIP39(passphrase);
    }
}

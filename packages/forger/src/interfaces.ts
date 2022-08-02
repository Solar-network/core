import { Interfaces } from "@solar-network/crypto";
import { Client } from "@solar-network/nes";

/**
 * @export
 * @interface RelayHost
 */
export interface RelayHost {
    /**
     * @type {string}
     * @memberof RelayHost
     */
    hostname: string;

    /**
     * @type {number}
     * @memberof RelayHost
     */
    port: number;

    /**
     * @type {Client}
     * @memberof RelayHost
     */
    socket?: Client;
}

/**
 * @export
 * @interface Delegate
 */
export interface Delegate {
    /**
     * @type {Interfaces.IKeyPair}
     * @memberof Delegate
     */
    keys: Interfaces.IKeyPair | undefined;

    /**
     * @type {string}
     * @memberof Delegate
     */
    publicKey: string;

    /**
     * @type {string}
     * @memberof Delegate
     */
    address: string;

    /**
     * @param {Interfaces.ITransactionData[]} transactions
     * @param {Record<string, any>} options
     * @returns {Interfaces.IBlock}
     * @memberof Delegate
     */
    forge(transactions: Interfaces.ITransactionData[], options: Record<string, any>): Interfaces.IBlock;
}

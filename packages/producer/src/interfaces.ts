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
 * @interface BlockProducer
 */
export interface BlockProducer {
    /**
     * @type {Interfaces.IKeyPair}
     * @memberof BlockProducer
     */
    keys: Interfaces.IKeyPair | undefined;

    /**
     * @type {string}
     * @memberof BlockProducer
     */
    publicKey: string;

    /**
     * @type {string}
     * @memberof BlockProducer
     */
    address: string;

    /**
     * @param {Interfaces.ITransaction[]} transactions
     * @param {Record<string, any>} options
     * @returns {Interfaces.IBlock}
     * @memberof BlockProducer
     */
    produce(transactions: Interfaces.ITransaction[], options: Record<string, any>): Interfaces.IBlock;
}

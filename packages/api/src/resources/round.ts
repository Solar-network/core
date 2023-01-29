import { Utils } from "@solar-network/crypto";
import { Container } from "@solar-network/kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class RoundResource implements Resource {
    /**
     * Return the raw representation of the resource.
     *
     * @param {*} resource
     * @returns {object}
     * @memberof Resource
     */
    public raw(resource: object): object {
        return resource;
    }

    /**
     * Return the transformed representation of the resource.
     *
     * @param {*} resource
     * @returns {object}
     * @memberof Resource
     */
    public transform(resource: { balance: string; publicKey: string; round: number; username: string }): object {
        const { balance, publicKey, round, username } = resource;
        return {
            publicKey,
            round,
            votes: Utils.BigNumber.make(balance).toFixed(),
            username,
        };
    }
}

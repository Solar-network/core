import { Container } from "@solar-network/core-kernel";
import { Utils } from "@solar-network/crypto";

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
    public transform(resource: { balance: string; publicKey: string }): object {
        return {
            publicKey: resource.publicKey,
            votes: Utils.BigNumber.make(resource.balance).toFixed(),
        };
    }
}

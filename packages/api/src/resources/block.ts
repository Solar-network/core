import { Interfaces } from "@solar-network/crypto";
import { Container } from "@solar-network/kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class BlockResource implements Resource {
    /**
     * Return the raw representation of the resource.
     *
     * @param {*} resource
     * @returns {object}
     * @memberof Resource
     */
    public raw(resource: Interfaces.IBlockData): object {
        return JSON.parse(JSON.stringify(resource));
    }

    /**
     * Return the transformed representation of the resource.
     *
     * @param {*} resource
     * @returns {object}
     * @memberof Resource
     */
    public transform(resource: Interfaces.IBlockData): object {
        throw new Error("Deprecated, use BlockWithTransactionsResources instead");
    }
}

import { Container, Utils } from "@solar-network/kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class MissedBlockResource implements Resource {
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
    public transform(resource: { timestamp: number; height: number; username: string }): object {
        return {
            height: resource.height,
            timestamp: Utils.formatTimestamp(resource.timestamp),
            username: resource.username,
        };
    }
}

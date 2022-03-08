import { Container, Providers } from "@solar-network/core-kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class PortsResource implements Resource {
    /**
     * @protected
     * @type {Providers.ServiceProviderRepository}
     * @memberof PortsResource
     */
    @Container.inject(Container.Identifiers.ServiceProviderRepository)
    protected readonly serviceProviderRepository!: Providers.ServiceProviderRepository;

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
    public transform(resource: object): object {
        const result = {};
        const keys = ["@solar-network/core-p2p", "@solar-network/core-api", "@solar-network/core-webhooks"];

        for (const serviceProvider of this.serviceProviderRepository.allLoadedProviders()) {
            const name: string = serviceProvider.name()!;
            const options: Record<string, any> = serviceProvider.config().all();

            if (keys.includes(name) && options.enabled) {
                if (options.server && options.server.enabled) {
                    result[name] = +options.server.port;

                    continue;
                }

                result[name] = +options.port;
            }
        }

        return result;
    }
}

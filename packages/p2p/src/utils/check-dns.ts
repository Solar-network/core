import { Container, Contracts, Utils } from "@solar-network/kernel";
import dns from "dns";
import util from "util";

export const checkDNS = async (app: Contracts.Kernel.Application, hosts: string[]): Promise<string> => {
    hosts = Utils.shuffle(hosts);

    const lookupService = util.promisify(dns.lookupService);

    for (let i = hosts.length - 1; i >= 0; i--) {
        try {
            await lookupService(hosts[i], 53);

            return Promise.resolve(hosts[i]);
        } catch (err) {
            app.getTagged<Contracts.Kernel.Logger>(Container.Identifiers.LogService, "package", "p2p").error(
                err.message,
            );
        }
    }

    return Promise.reject(new Error("Please check your network connectivity, couldn't connect to any host"));
};

import { Managers } from "@solar-network/crypto";
import { Container, Contracts, Providers } from "@solar-network/kernel";
import semver from "semver";

// todo: review the implementation
export const isValidVersion = (app: Contracts.Kernel.Application, peer: Contracts.P2P.Peer): boolean => {
    if (!peer.version) {
        return false;
    }

    if (!semver.valid(peer.version)) {
        return false;
    }

    let minimumVersions: string[];
    const milestones: Record<string, any> = Managers.configManager.getMilestone();

    const { p2p } = milestones;

    if (p2p && Array.isArray(p2p.minimumVersions) && p2p.minimumVersions.length > 0) {
        minimumVersions = p2p.minimumVersions;
    } else {
        const configuration = app.getTagged<Providers.PluginConfiguration>(
            Container.Identifiers.PluginConfiguration,
            "plugin",
            "@solar-network/p2p",
        );
        minimumVersions = configuration.getOptional<string[]>("minimumVersions", []);
    }

    const includePrerelease: boolean = Managers.configManager.get("network.name") !== "mainnet";
    return minimumVersions.some((minimumVersion: string) =>
        semver.satisfies(peer.version!, minimumVersion, { includePrerelease }),
    );
};

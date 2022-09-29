import { Container, Contracts, Enums, Providers, Utils as AppUtils } from "@solar-network/kernel";
import delay from "delay";

import { PeerFactory } from "./contracts";
import { DisconnectInvalidPeers } from "./listeners";
import { isValidPeer } from "./utils";

// todo: review the implementation
@Container.injectable()
export class PeerProcessor implements Contracts.P2P.PeerProcessor {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/p2p")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PeerCommunicator)
    private readonly communicator!: Contracts.P2P.PeerCommunicator;

    @Container.inject(Container.Identifiers.PeerConnector)
    private readonly connector!: Contracts.P2P.PeerConnector;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly repository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public server: any;
    public nextUpdateNetworkStatusScheduled: boolean = false;

    @Container.postConstruct()
    public initialise(): void {
        this.events.listen(Enums.CryptoEvent.MilestoneChanged, this.app.resolve(DisconnectInvalidPeers));
    }

    public isWhitelisted(peer: Contracts.P2P.Peer): boolean {
        return AppUtils.isWhitelisted(this.configuration.getOptional<string[]>("remoteAccess", []), peer.ip);
    }

    public async validateAndAcceptPeer(
        peer: Contracts.P2P.Peer,
        options: Contracts.P2P.AcceptNewPeerOptions = {},
    ): Promise<void> {
        if (this.validatePeerIp(peer, options)) {
            await this.acceptNewPeer(peer, options);
        }
    }

    public validatePeerIp(peer: Contracts.P2P.Peer, options: Contracts.P2P.AcceptNewPeerOptions = {}): boolean {
        if (this.configuration.get("disableDiscovery")) {
            this.logger.warning(`Rejected ${peer.ip} because the relay is in non-discovery mode`, "🙈");

            return false;
        }

        if (!isValidPeer(peer) || this.repository.hasPendingPeer(peer.ip)) {
            return false;
        }

        // Is Whitelisted
        if (!AppUtils.isWhitelisted(this.configuration.get("whitelist") || [], peer.ip)) {
            return false;
        }

        // Is Blacklisted
        if (AppUtils.isBlacklisted(this.configuration.get("blacklist") || [], peer.ip)) {
            return false;
        }

        const maxSameSubnetPeers = this.configuration.getRequired<number>("maxSameSubnetPeers");

        if (this.repository.getSameSubnetPeers(peer.ip).length >= maxSameSubnetPeers && !options.seed) {
            if (process.env.SOLAR_CORE_P2P_PEER_VERIFIER_DEBUG_EXTRA?.toLowerCase() === "true") {
                this.logger.warning(
                    `Rejected ${peer.ip} because we are already at the ${maxSameSubnetPeers} limit for peers sharing the same /24 subnet`,
                    "🚫",
                );
            }

            return false;
        }

        return true;
    }

    private async ping(peer: Contracts.P2P.Peer, verifyTimeout: number): Promise<void> {
        const lastBlock = this.app.get<Contracts.State.StateStore>(Container.Identifiers.StateStore).getLastBlock();
        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(
            this.app,
            lastBlock.data.height,
        );

        return new Promise<void>((resolve, reject) => {
            let isResolved = false;
            let isRejected = false;

            const resolvesFirst = () => {
                if (!isResolved && !isRejected) {
                    isResolved = true;
                    resolve();
                }
            };

            const rejectsFirst = () => {
                if (!isResolved && !isRejected) {
                    isRejected = true;
                    reject();
                }
            };

            this.communicator.ping(peer, verifyTimeout, blockTimeLookup).then(resolvesFirst).catch(rejectsFirst);

            delay(verifyTimeout).finally(isResolved ? resolvesFirst : rejectsFirst);
        });
    }

    private async acceptNewPeer(peer: Contracts.P2P.Peer, options: Contracts.P2P.AcceptNewPeerOptions): Promise<void> {
        const verifyTimeout = this.configuration.getRequired<number>("verifyTimeout");

        if (this.repository.hasPeer(peer.ip)) {
            const oldPeer: Contracts.P2P.Peer = this.repository.getPeer(peer.ip);
            try {
                const { stale } = oldPeer;
                await this.ping(oldPeer, verifyTimeout);
                if (stale) {
                    await this.communicator.pingPorts(oldPeer);
                }
            } catch {
                //
            }
            return;
        }

        const newPeer: Contracts.P2P.Peer = this.app.get<PeerFactory>(Container.Identifiers.PeerFactory)(
            peer.ip,
            peer.port,
        );

        try {
            this.repository.setPendingPeer(peer);
            await this.ping(newPeer, verifyTimeout);
            await this.communicator.pingPorts(newPeer);

            this.repository.setPeer(newPeer);

            if (
                !options.lessVerbose ||
                process.env.SOLAR_CORE_P2P_PEER_VERIFIER_DEBUG_EXTRA?.toLowerCase() === "true"
            ) {
                this.logger.debug(`Accepted new peer ${newPeer.ip}:${newPeer.port} (v${newPeer.version})`, "🤗");
            }

            this.events.dispatch(Enums.PeerEvent.Added, newPeer);
        } catch (error) {
            this.connector.disconnect(newPeer);
        } finally {
            this.repository.forgetPendingPeer(peer);
        }

        return;
    }
}

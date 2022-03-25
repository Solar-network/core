import { Container, Contracts, Enums, Providers, Utils as AppUtils } from "@solar-network/core-kernel";
import { Utils } from "@solar-network/crypto";

import { PeerFactory } from "./contracts";
import { DisconnectInvalidPeers } from "./listeners";

// todo: review the implementation
@Container.injectable()
export class PeerProcessor implements Contracts.P2P.PeerProcessor {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/core-p2p")
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
    public initialize(): void {
        this.events.listen(Enums.CryptoEvent.MilestoneChanged, this.app.resolve(DisconnectInvalidPeers));
    }

    public isWhitelisted(peer: Contracts.P2P.Peer): boolean {
        return AppUtils.isWhitelisted(this.configuration.getOptional<string[]>("remoteAccess", []), peer.ip);
    }

    public async validateAndAcceptPeer(
        peer: Contracts.P2P.Peer,
        options: Contracts.P2P.AcceptNewPeerOptions = {},
    ): Promise<void> {
        /* istanbul ignore else */
        if (this.validatePeerIp(peer, options)) {
            await this.acceptNewPeer(peer, options);
        }
    }

    public validatePeerIp(peer: Contracts.P2P.Peer, options: Contracts.P2P.AcceptNewPeerOptions = {}): boolean {
        if (this.configuration.get("disableDiscovery")) {
            this.logger.warning(`Rejected ${peer.ip} because the relay is in non-discovery mode :see_no_evil:`);

            return false;
        }

        if (!Utils.isValidPeer(peer) || this.repository.hasPendingPeer(peer.ip)) {
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
            /* istanbul ignore else */
            if (process.env.CORE_P2P_PEER_VERIFIER_DEBUG_EXTRA) {
                this.logger.warning(
                    `Rejected ${peer.ip} because we are already at the ${maxSameSubnetPeers} limit for peers sharing the same /24 subnet :no_entry:`,
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
        return this.communicator.ping(peer, verifyTimeout, blockTimeLookup);
    }

    private async acceptNewPeer(peer, options: Contracts.P2P.AcceptNewPeerOptions): Promise<void> {
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

        const newPeer: Contracts.P2P.Peer = this.app.get<PeerFactory>(Container.Identifiers.PeerFactory)(peer.ip);

        try {
            this.repository.setPendingPeer(peer);
            await this.ping(newPeer, verifyTimeout);
            await this.communicator.pingPorts(newPeer);

            this.repository.setPeer(newPeer);

            /* istanbul ignore next */
            if (!options.lessVerbose || process.env.CORE_P2P_PEER_VERIFIER_DEBUG_EXTRA) {
                this.logger.debug(
                    `Accepted new peer ${newPeer.ip}:${newPeer.port} (v${newPeer.version}) :hugging_face:`,
                );
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

import { Container, Contracts, Providers, Utils } from "@solar-network/core-kernel";
import { Crypto, Interfaces, Managers } from "@solar-network/crypto";

import { NetworkStateStatus } from "./enums";
import { Peer } from "./peer";

class QuorumDetails {
    /**
     * Number of peers or delegates on same height, with same block and same slot.
     * Used for quorum calculation.
     */
    public hasQuorum = 0;

    /**
     * Number of peers or delegates which do not meet the quorum requirements.
     * Used for quorum calculation.
     */
    public noQuorum = 0;

    /**
     * Number of overheight peers or delegates.
     */
    public overHeight = 0;

    /**
     * All overheight block headers.
     */
    public overHeightBlockHeaders: { [ip: string]: any } = {};

    /**
     * The following properties are not mutually exclusive and imply a peer
     * or delegate is on the same `nodeHeight`.
     */

    /**
     * Number of peers or delegates that are on a different chain (forked).
     */
    public forked = 0;

    /**
     * Number of peers or delegates with a different slot.
     */
    public differentSlot = 0;

    /**
     * Number of peers or delegates where forging is not allowed.
     */
    public forgingNotAllowed = 0;

    public getQuorum() {
        const quorum = this.hasQuorum / (this.hasQuorum + this.noQuorum);

        /* istanbul ignore next */
        return isFinite(quorum) ? quorum : 0;
    }

    public canForge() {
        const milestone = Managers.configManager.getMilestone();
        let threshold = 0.66;
        if (milestone.onlyActiveDelegatesInCalculations) {
            threshold = Math.min(1, (Math.floor(milestone.activeDelegates / 2) + 1) / (this.hasQuorum + this.noQuorum));
        }
        return this.getQuorum() >= threshold;
    }
}

// todo: review the implementation
export class NetworkState implements Contracts.P2P.NetworkState {
    private nodeHeight?: number;
    private lastBlockId?: string;
    private quorumDetails: QuorumDetails;

    public constructor(public readonly status: NetworkStateStatus, lastBlock?: Interfaces.IBlock) {
        this.quorumDetails = new QuorumDetails();

        if (lastBlock) {
            this.setLastBlock(lastBlock);
        }
    }

    public static async analyze(
        monitor: Contracts.P2P.NetworkMonitor,
        repository: Contracts.P2P.PeerRepository,
        delegatesOnThisNode: string[],
    ): Promise<Contracts.P2P.NetworkState> {
        // @ts-ignore - app exists but isn't on the interface for now
        const lastBlock: Interfaces.IBlock = monitor.app
            .get<any>(Container.Identifiers.BlockchainService)
            .getLastBlock();

        const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(
            // @ts-ignore - app exists but isn't on the interface for now
            monitor.app,
            lastBlock.data.height,
        );
        const slotInfo = Crypto.Slots.getSlotInfo(blockTimeLookup);

        let peers: Contracts.P2P.Peer[] = repository.getPeers();

        // @ts-ignore - app exists but isn't on the interface for now
        const configuration = monitor.app.getTagged<Providers.PluginConfiguration>(
            Container.Identifiers.PluginConfiguration,
            "plugin",
            "@solar-network/core-p2p",
        );

        const milestone = Managers.configManager.getMilestone();
        if (milestone.onlyActiveDelegatesInCalculations) {
            if (delegatesOnThisNode.length > 0) {
                const localPeer: Contracts.P2P.Peer = new Peer(
                    "127.0.0.1",
                    configuration.getRequired<number>("server.port"),
                );
                localPeer.publicKeys = delegatesOnThisNode;
                localPeer.state = {
                    height: lastBlock.data.height,
                    forgingAllowed: slotInfo.forgingStatus,
                    currentSlot: slotInfo.slotNumber,
                    header: lastBlock.getHeader(),
                };
                peers.forEach((peer) => {
                    peer.publicKeys = peer.publicKeys.filter((publicKey) => !delegatesOnThisNode.includes(publicKey));
                });
                peers.push(localPeer);
            }
            peers = peers.filter((peer) => peer.isActiveDelegate());
        }

        const minimumDelegateReach = configuration.getOptional<number>(
            "minimumDelegateReach",
            Math.floor(milestone.activeDelegates / 2) + 1,
        );
        const minimumNetworkReach = configuration.getOptional<number>("minimumNetworkReach", 20);

        if (monitor.isColdStart()) {
            monitor.completeColdStart();
            return new NetworkState(NetworkStateStatus.ColdStart, lastBlock);
        } else if (process.env.CORE_ENV === "test") {
            return new NetworkState(NetworkStateStatus.Test, lastBlock);
        } else if (!milestone.onlyActiveDelegatesInCalculations && repository.getPeers().length < minimumNetworkReach) {
            return new NetworkState(NetworkStateStatus.BelowMinimumPeers, lastBlock);
        } else if (
            milestone.onlyActiveDelegatesInCalculations &&
            peers.flatMap((peer) => peer.publicKeys).length < minimumDelegateReach
        ) {
            return new NetworkState(NetworkStateStatus.BelowMinimumDelegates, lastBlock);
        }

        return this.analyzeNetwork(lastBlock, peers, blockTimeLookup);
    }

    public static parse(data: any): Contracts.P2P.NetworkState {
        if (!data || data.status === undefined) {
            return new NetworkState(NetworkStateStatus.Unknown);
        }

        const networkState = new NetworkState(data.status);
        networkState.nodeHeight = data.nodeHeight;
        networkState.lastBlockId = data.lastBlockId;

        Object.assign(networkState.quorumDetails, data.quorumDetails);

        return networkState;
    }

    private static analyzeNetwork(
        lastBlock,
        peers: Contracts.P2P.Peer[],
        getTimeStampForBlock: (height: number) => number,
    ): Contracts.P2P.NetworkState {
        const networkState = new NetworkState(NetworkStateStatus.Default, lastBlock);
        const currentSlot = Crypto.Slots.getSlotNumber(getTimeStampForBlock);

        for (const peer of peers) {
            networkState.update(peer, currentSlot);
        }

        return networkState;
    }

    public canForge(): boolean {
        if (this.status === NetworkStateStatus.Test) {
            return true;
        }

        return this.quorumDetails.canForge();
    }

    public getNodeHeight(): number | undefined {
        return this.nodeHeight;
    }

    public getLastBlockId(): string | undefined {
        return this.lastBlockId;
    }

    public getQuorum(): number {
        if (this.status === NetworkStateStatus.Test) {
            return 1;
        }

        return this.quorumDetails.getQuorum();
    }

    public getOverHeightBlockHeaders(): { [ip: string]: any } {
        return Object.values(this.quorumDetails.overHeightBlockHeaders);
    }

    public setOverHeightBlockHeaders(overHeightBlockHeaders): void {
        this.quorumDetails.overHeightBlockHeaders = overHeightBlockHeaders;
    }

    public toJson(): string {
        const data = { quorum: this.getQuorum() } as any;
        Object.assign(data, this);
        delete data.status;

        return JSON.stringify(data, undefined, 2);
    }

    private setLastBlock(lastBlock: Interfaces.IBlock): void {
        this.nodeHeight = lastBlock.data.height;
        this.lastBlockId = lastBlock.data.id;
    }

    private update(peer: Contracts.P2P.Peer, currentSlot: number): void {
        Utils.assert.defined<number>(this.nodeHeight);

        const milestone = Managers.configManager.getMilestone();
        let increment = 1;
        if (milestone.onlyActiveDelegatesInCalculations) {
            increment = peer.publicKeys.length;
        }
        if (typeof peer.state.header === "object" && typeof peer.state.header.height === "number") {
            if (peer.state.header.height != this.nodeHeight) {
                this.quorumDetails.noQuorum += increment;
                if (peer.state.header.height > this.nodeHeight) {
                    this.quorumDetails.overHeight += increment;
                    this.quorumDetails.overHeightBlockHeaders[peer.ip] = peer.state.header;
                }
            } else {
                if (peer.isForked()) {
                    this.quorumDetails.noQuorum += increment;
                    this.quorumDetails.forked += increment;
                } else {
                    this.quorumDetails.hasQuorum += increment;
                }
            }
        }

        // Just statistics in case something goes wrong.
        if (peer.state.currentSlot !== currentSlot) {
            this.quorumDetails.differentSlot += increment;
        }

        if (!peer.state.forgingAllowed) {
            this.quorumDetails.forgingNotAllowed += increment;
        }
    }
}

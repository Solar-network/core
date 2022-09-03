import { Identities, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Enums, Providers, Services, Utils } from "@solar-network/kernel";
import delay from "delay";
import { readJsonSync } from "fs-extra";
import prettyMs from "pretty-ms";
import { gt, lt, satisfies } from "semver";

import { NetworkState } from "./network-state";
import { Peer } from "./peer";
import { PeerCommunicator } from "./peer-communicator";
import { PeerVerificationResult } from "./peer-verifier";
import { checkDNS, checkNTP } from "./utils";

const defaultDownloadChunkSize = 400;

// todo: review the implementation
@Container.injectable()
export class NetworkMonitor implements Contracts.P2P.NetworkMonitor {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/p2p")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PeerCommunicator)
    private readonly communicator!: PeerCommunicator;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly repository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.PeerChunkCache)
    private readonly chunkCache!: Contracts.P2P.ChunkCache;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public config: any;
    public nextUpdateNetworkStatusScheduled: boolean | undefined;
    private coldStart: boolean = false;

    private downloadChunkSize: number = defaultDownloadChunkSize;

    private initialising = true;
    private lastPinged: number = 0;

    private cachedTransactions: Map<string, number> = new Map();

    @Container.postConstruct()
    public initialise(): void {
        this.config = this.configuration.all(); // >_<
    }

    public async boot(): Promise<void> {
        await this.checkDNSConnectivity(this.config.dns);
        await this.checkNTPConnectivity(this.config.ntp);

        await this.populateSeedPeers();

        if (this.config.skipDiscovery) {
            this.logger.warning("Skipped peer discovery because the relay is in skip-discovery mode :see_no_evil:");
        } else {
            await this.updateNetworkStatus(true);

            const ourVersion = this.app.version();

            for (const [version, peers] of Object.entries(
                Utils.groupBy(this.repository.getPeers(), (peer) => peer.version),
            )) {
                let discovery = `Discovered ${Utils.pluralise("peer", peers.length, true)} with v${version}`;

                if (gt(version, ourVersion)) {
                    discovery += " :eyes:";
                } else if (lt(version, ourVersion)) {
                    discovery += " :zzz:";
                }

                this.logger.info(discovery);
            }
        }

        this.events.listen(Enums.BlockchainEvent.Synced, {
            handle: async () => {
                await delay(1000);
                this.pingAll();
            },
        });

        this.events.listen(Enums.RoundEvent.Applied, {
            handle: () => {
                const synced = this.app
                    .get<Contracts.Blockchain.Blockchain>(Container.Identifiers.BlockchainService)
                    .isSynced();
                if (synced) {
                    this.pingAll();
                }
            },
        });

        this.initialising = false;
    }

    public async updateNetworkStatus(initialRun?: boolean): Promise<void> {
        if (process.env.NODE_ENV === "test") {
            return;
        }

        if (this.config.networkStart) {
            this.coldStart = true;
            this.logger.warning("Entering cold start because the relay is in genesis-start mode :snowflake:");
        }

        if (this.config.disableDiscovery) {
            this.logger.warning("Skipped peer discovery because the relay is in non-discovery mode :mag:");
            return;
        }

        try {
            if (await this.discoverPeers(initialRun)) {
                await this.cleansePeers();
            }
        } catch (error) {
            this.logger.error(`Network Status: ${error.message} :warning:`);
        }

        let nextRunDelaySeconds = 600;

        if (!this.hasMinimumPeers()) {
            await this.populateSeedPeers();

            nextRunDelaySeconds = 60;

            this.logger.info(`Couldn't find enough peers. Falling back to seed peers :fire:`);
        }

        this.scheduleUpdateNetworkStatus(nextRunDelaySeconds);
    }

    public async cleansePeers({
        fast = false,
        forcePing = false,
        log = true,
        peerCount,
        skipCommonBlocks = false,
    }: {
        fast?: boolean;
        forcePing?: boolean;
        log?: boolean;
        peerCount?: number;
        skipCommonBlocks?: boolean;
    } = {}): Promise<void> {
        let peers = this.repository.getPeers();
        let max = peers.length;

        let unresponsivePeers = 0;
        const pingDelay = fast ? 2500 : this.config.verifyTimeout;

        if (peerCount) {
            peers = Utils.shuffle(peers).slice(0, peerCount);
            max = Math.min(peers.length, peerCount);
        }

        if (log) {
            this.logger.info(`Checking ${Utils.pluralise("peer", max, true)} :telescope:`);
        }
        const peerErrors = {};

        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();
        const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(this.app, lastBlock.data.height);

        const pingedPeers: Set<Contracts.P2P.Peer> = new Set();

        // we use Promise.race to cut loose in case some communicator.ping() does not resolve within the delay
        // in that case we want to keep on with our program execution while ping promises can finish in the background
        await new Promise<void>((resolve) => {
            let isResolved = false;

            const resolvesFirst = () => {
                if (!isResolved) {
                    isResolved = true;
                    resolve();
                }
            };

            Promise.all(
                peers.map(async (peer) => {
                    try {
                        pingedPeers.add(peer);
                        await this.communicator.ping(peer, pingDelay, blockTimeLookup, forcePing, skipCommonBlocks);
                    } catch (error) {
                        unresponsivePeers++;

                        peerErrors[error] = peerErrors[error] || [];
                        peerErrors[error].push(peer);

                        await this.events.dispatch(Enums.PeerEvent.Disconnect, { peer });

                        this.events.dispatch(Enums.PeerEvent.Removed, peer);
                    } finally {
                        pingedPeers.delete(peer);
                    }
                }),
            ).then(resolvesFirst);

            delay(pingDelay).finally(resolvesFirst);
        });

        for (const peer of pingedPeers) {
            peer.addInfraction();
        }

        for (const key of Object.keys(peerErrors)) {
            const peerCount = peerErrors[key].length;
            this.logger.debug(`Removed ${Utils.pluralise("peer", peerCount, true)} because of "${key}" :wastebasket:`);
        }

        if (this.initialising) {
            this.logger.info(
                `${max - unresponsivePeers} of ${Utils.pluralise("peer", max, true)} on the network are responsive`,
            );
            this.logger.info(`Median Network Height: ${this.getNetworkHeight().toLocaleString()}`);
        }
    }

    public async discoverPeers(pingAll?: boolean, addAll?: boolean, silent?: boolean): Promise<boolean> {
        const maxPeersPerPeer = 50;
        const ownPeers: Contracts.P2P.Peer[] = this.repository.getPeers();
        let peersToTry: Contracts.P2P.Peer[] = [...ownPeers];

        if (addAll) {
            const peersThatWouldThrottle: boolean[] = await Promise.all(
                peersToTry.map((peer) => this.communicator.wouldThrottleOnFetchingPeers(peer)),
            );
            peersToTry = peersToTry.filter((peer, index) => !peersThatWouldThrottle[index]);
        }

        const theirPeers: Contracts.P2P.Peer[] = Object.values(
            (
                await Promise.all(
                    Utils.shuffle(peersToTry)
                        .slice(0, 8)
                        .map(async (peer: Contracts.P2P.Peer) => {
                            try {
                                const theirPeers = await this.communicator.getPeers(peer, silent);
                                return theirPeers || [];
                            } catch (error) {
                                if (!silent) {
                                    this.logger.debug(
                                        `Failed to get peers from ${peer.ip}: ${error.message} :exclamation:`,
                                    );
                                }
                                return [];
                            }
                        }),
                )
            )
                .map((peers) =>
                    Utils.shuffle(peers)
                        .slice(0, maxPeersPerPeer)
                        .reduce(
                            (acc: object, curr: Contracts.P2P.PeerBroadcast) => ({
                                ...acc,
                                ...{ [curr.ip]: new Peer(curr.ip, curr.port) },
                            }),
                            {},
                        ),
                )
                .reduce((acc: object, curr: { [ip: string]: Contracts.P2P.Peer }) => ({ ...acc, ...curr }), {}),
        );

        if (pingAll || addAll || !this.hasMinimumPeers() || ownPeers.length < theirPeers.length * 0.75) {
            await Promise.all(
                theirPeers.map((p) =>
                    this.app
                        .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
                        .call("validateAndAcceptPeer", { peer: p, options: { lessVerbose: true } }),
                ),
            );
            this.pingPeerPorts(pingAll, silent);

            return true;
        }

        this.pingPeerPorts(false, silent);

        return false;
    }

    public isColdStart(): boolean {
        return this.coldStart;
    }

    public completeColdStart(): void {
        this.coldStart = false;
    }

    public getNetworkHeight(): number {
        const medians = this.repository
            .getPeers()
            .filter((peer) => peer.state.height)
            .map((peer) => peer.state.height)
            .sort((a, b) => {
                Utils.assert.defined<string>(a);
                Utils.assert.defined<string>(b);

                return a - b;
            });

        return medians[Math.floor(medians.length / 2)] || 0;
    }

    public async getNetworkState(log: boolean = true): Promise<Contracts.P2P.NetworkState> {
        await this.cleansePeers({ fast: true, forcePing: true, log, skipCommonBlocks: true });
        return await NetworkState.analyze(this, this.repository, await this.getDelegatesOnThisNode());
    }

    public async refreshPeersAfterFork(): Promise<void> {
        this.logger.info(
            `Refreshing ${Utils.pluralise(
                "peer",
                this.repository.getPeers().length,
                true,
            )} after fork :fork_and_knife:`,
        );

        await this.cleansePeers({ forcePing: true });
    }

    public async checkNetworkHealth(fast?: boolean): Promise<Contracts.P2P.NetworkStatus> {
        if (!fast) {
            await this.discoverPeers(true);
        }
        await this.cleansePeers({ fast, forcePing: true });

        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

        const includedPeers: Contracts.P2P.Peer[] = [];
        const relayPeers: Contracts.P2P.Peer[] = [];

        const peers: Contracts.P2P.Peer[] = this.repository.getPeers();
        const milestone = Managers.configManager.getMilestone();
        const localPeer: Contracts.P2P.Peer = new Peer(
            "127.0.0.1",
            this.configuration.getRequired<number>("server.port"),
        );
        localPeer.publicKeys = await this.getDelegatesOnThisNode();
        localPeer.verificationResult = new PeerVerificationResult(
            lastBlock.data.height,
            lastBlock.data.height,
            lastBlock.data.height,
        );

        for (const peer of peers) {
            peer.publicKeys = peer.publicKeys.filter((publicKey) => !localPeer.publicKeys.includes(publicKey));
        }
        peers.push(localPeer);

        for (const peer of peers) {
            if (peer.isActiveDelegate()) {
                for (let i = 0; i < peer.publicKeys.length; i++) {
                    includedPeers.push(peer);
                }
            } else if (peer.state && peer.state.height! > lastBlock.data.height) {
                relayPeers.push(peer);
            }
        }

        const halfPlusOne: number = Math.floor(milestone.activeDelegates / 2) + 1;

        if (includedPeers.length < halfPlusOne) {
            includedPeers.push(...relayPeers);
            if (includedPeers.length < halfPlusOne) {
                this.logger.info("Not enough peers available to check network health :no_entry_sign:");

                return { forked: false };
            }
        }

        const verificationResults: Contracts.P2P.PeerVerificationResult[] = includedPeers
            .filter((peer) => peer.verificationResult)
            .map((peer) => peer.verificationResult!);

        if (verificationResults.length === 0) {
            this.logger.info("No verified peers available to check network health :no_entry_sign:");

            return { forked: false };
        }

        const forkVerificationResults: Contracts.P2P.PeerVerificationResult[] = verificationResults.filter(
            (verificationResult: Contracts.P2P.PeerVerificationResult) => verificationResult.forked,
        );

        const forkHeights: number[] = forkVerificationResults
            .map((verificationResult: Contracts.P2P.PeerVerificationResult) => verificationResult.highestCommonHeight)
            .filter((forkHeight, i, arr) => arr.indexOf(forkHeight) === i) // unique
            .sort()
            .reverse();

        for (const forkHeight of forkHeights) {
            const forkPeerCount = forkVerificationResults.filter((vr) => vr.highestCommonHeight === forkHeight).length;
            const ourPeerCount = verificationResults.filter((vr) => vr.highestCommonHeight > forkHeight).length;
            if (forkPeerCount > ourPeerCount) {
                const blocksToRollback = lastBlock.data.height - forkHeight;

                if (blocksToRollback > 5000) {
                    this.logger.warning(
                        `Fork detected - rolling back ${(5000).toLocaleString()}/${blocksToRollback.toLocaleString()} blocks to fork at height ${forkHeight.toLocaleString()} (${ourPeerCount.toLocaleString()} vs ${forkPeerCount.toLocaleString()}) :repeat:`,
                    );

                    return { forked: true, blocksToRollback: 5000 };
                } else if (blocksToRollback > 0) {
                    this.logger.warning(
                        `Fork detected - rolling back ${Utils.pluralise(
                            "block",
                            blocksToRollback,
                            true,
                        )} to fork at height ${forkHeight.toLocaleString()} (${ourPeerCount.toLocaleString()} vs ${forkPeerCount.toLocaleString()}) :repeat:`,
                    );

                    return { forked: true, blocksToRollback };
                } else {
                    return { forked: false };
                }
            } else {
                this.logger.debug(
                    `Ignoring fork at height ${forkHeight.toLocaleString()} (${ourPeerCount.toLocaleString()} vs ${forkPeerCount.toLocaleString()}) :fork_and_knife:`,
                );
            }
        }

        return { forked: false };
    }

    public async getAllDelegates(): Promise<string[]> {
        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

        const height = lastBlock.data.height + 1;
        const roundInfo = Utils.roundCalculator.calculateRound(height);

        return (
            (await this.triggers.call("getActiveDelegates", {
                roundInfo,
            })) as Contracts.State.Wallet[]
        ).map((wallet) => wallet.getAttribute("delegate.username"));
    }

    public getDelegateName(publicKey: string): string | undefined {
        if (this.walletRepository.hasByPublicKey(publicKey)) {
            return this.walletRepository.findByPublicKey(publicKey).getAttribute("delegate.username");
        }
        return undefined;
    }

    public async checkForFork(): Promise<number> {
        if (this.repository.getPeers().length === 0) {
            return 0;
        }

        await delay(1000); // give time for the block to be widely propagated
        let networkStatus = await this.checkNetworkHealth(true); // fast check using our current peers
        if (!networkStatus.forked) {
            networkStatus = await this.checkNetworkHealth(); // slower check with the entire network
        }
        if (networkStatus.forked && networkStatus.blocksToRollback! > 0) {
            return networkStatus.blocksToRollback!;
        }

        return 0;
    }

    public async downloadBlockAtHeight(ip: string, height: number): Promise<Interfaces.IBlockData | undefined> {
        if (!this.repository.hasPeer(ip)) {
            return;
        }

        const peer: Contracts.P2P.Peer = this.repository.getPeer(ip);
        const blocks: Interfaces.IBlockData[] = await this.communicator.getPeerBlocks(peer, {
            fromBlockHeight: height - 1,
            blockLimit: 1,
            silent: true,
            timeout: 2000,
        });
        return blocks[0];
    }

    public async downloadBlocksFromHeight(
        fromBlockHeight: number,
        maxParallelDownloads = 10,
        silent = false,
        timeout: number,
        checkThrottle: boolean = false,
    ): Promise<Interfaces.IBlockData[]> {
        let peersAll: Contracts.P2P.Peer[] = this.repository.getPeers();

        if (peersAll.length === 0) {
            if (!silent) {
                this.logger.error(`Could not download blocks: we have 0 peers :bangbang:`);
            }
            return [];
        }

        if (checkThrottle) {
            const peersThatWouldThrottle: boolean[] = await Promise.all(
                peersAll.map((peer) => this.communicator.wouldThrottleOnDownload(peer)),
            );
            peersAll = peersAll.filter((peer, index) => !peersThatWouldThrottle[index]);
        }

        const networkHeight: number = this.getNetworkHeight();
        let chunksMissingToSync: number;

        if (!networkHeight || networkHeight <= fromBlockHeight) {
            chunksMissingToSync = 1;
        } else {
            chunksMissingToSync = Math.ceil((networkHeight - fromBlockHeight) / this.downloadChunkSize);
        }
        const chunksToDownload: number = Math.min(chunksMissingToSync, peersAll.length, maxParallelDownloads);

        // We must return an uninterrupted sequence of blocks, starting from `fromBlockHeight`,
        // with sequential heights, without gaps.

        const downloadJobs: Function[] = [];
        const downloadResults: any = [];
        let someJobFailed: boolean = false;
        let chunksHumanReadable: string = "";

        for (let i = 0; i < chunksToDownload; i++) {
            const height: number = fromBlockHeight + this.downloadChunkSize * i;
            const isLastChunk: boolean = i === chunksToDownload - 1;
            const blocksRange: string = `[${(height + 1).toLocaleString()}, ${(isLastChunk
                ? ".."
                : height + this.downloadChunkSize
            ).toLocaleString()}]`;

            downloadJobs.push(async () => {
                if (this.chunkCache.has(blocksRange)) {
                    downloadResults[i] = this.chunkCache.get(blocksRange);
                    // Remove it from the cache so that it does not get served many times
                    // from the cache. In case of network reorganization or downloading
                    // flawed chunks we want to re-download from another peer.
                    this.chunkCache.remove(blocksRange);
                    return;
                }

                let blocks!: Interfaces.IBlockData[];
                let peer: Contracts.P2P.Peer;
                let peerPrint!: string;

                // As a first peer to try, pick such a peer that different jobs use different peers.
                // If that peer fails then pick randomly from the remaining peers that have not
                // been first-attempt for any job.
                const peersToTry = [peersAll[i], ...Utils.shuffle(peersAll.slice(chunksToDownload))];
                if (peersToTry.length === 1) {
                    // special case where we don't have "backup peers" (that have not been first-attempt for any job)
                    // so add peers that have been first-attempt as backup peers
                    peersToTry.push(...peersAll.filter((p) => p.ip !== peersAll[i].ip));
                }

                for (peer of peersToTry) {
                    peerPrint = `${peer.ip}:${peer.port}`;
                    try {
                        blocks = await this.communicator.getPeerBlocks(peer, {
                            fromBlockHeight: height,
                            blockLimit: this.downloadChunkSize,
                            silent,
                            timeout,
                        });

                        if (blocks.length > 0 || isLastChunk) {
                            // when `isLastChunk` it can be normal that the peer does not send any block (when none were forged)
                            if (!silent) {
                                this.logger.debug(
                                    `Downloaded blocks ${blocksRange} (${blocks.length}) ` + `from ${peerPrint}`,
                                );
                            }
                            downloadResults[i] = blocks;
                            return;
                        } else {
                            throw new Error("Peer did not return any block");
                        }
                    } catch (error) {
                        if (!silent) {
                            this.logger.info(
                                `Failed to download blocks ${blocksRange} from ${peerPrint}: ${error.message} :bangbang:`,
                            );
                        }
                    }

                    if (someJobFailed && !silent) {
                        this.logger.info(
                            `Giving up on trying to download blocks ${blocksRange}: ` +
                                `another download job failed :bangbang:`,
                        );
                    }
                }

                someJobFailed = true;
                throw new Error(
                    `Could not download blocks ${blocksRange} from any of ${peersToTry.length} ` +
                        `peer(s). Last attempt returned ${blocks.length} block(s) from peer ${peerPrint}`,
                );
            });

            if (chunksHumanReadable.length > 0) {
                chunksHumanReadable += ", ";
            }
            chunksHumanReadable += blocksRange;
        }

        if (!silent) {
            this.logger.debug(`Downloading blocks in chunks: ${chunksHumanReadable}`);
        }
        let firstFailureMessage!: string;

        const result = await Promise.allSettled(downloadJobs.map((f: Function) => f()));
        const failure = result.find((value) => value.status === "rejected");
        if (failure) {
            firstFailureMessage = (failure as any).reason;
        }

        let downloadedBlocks: Interfaces.IBlockData[] = [];

        let i;

        for (i = 0; i < chunksToDownload; i++) {
            if (downloadResults[i] === undefined) {
                if (!silent) {
                    this.logger.error(`${firstFailureMessage} :exclamation:`);
                }
                break;
            }
            downloadedBlocks = [...downloadedBlocks, ...downloadResults[i]];
        }
        // Save any downloaded chunks that are higher than a failed chunk for later reuse.
        for (i++; i < chunksToDownload; i++) {
            if (downloadResults[i]) {
                const height: number = fromBlockHeight + this.downloadChunkSize * i;
                const blocksRange: string = `[${(height + 1).toLocaleString()}, ${(
                    height + this.downloadChunkSize
                ).toLocaleString()}]`;

                this.chunkCache.set(blocksRange, downloadResults[i]);
            }
        }

        // if we did not manage to download any block, reduce chunk size for next time
        this.downloadChunkSize =
            downloadedBlocks.length === 0 ? Math.ceil(this.downloadChunkSize / 10) : defaultDownloadChunkSize;

        return downloadedBlocks;
    }

    public async downloadTransactions(exclude: string[]): Promise<Buffer[]> {
        const transactions: Set<String> = new Set();

        const peers: Contracts.P2P.Peer[] = this.repository
            .getPeers()
            .filter((peer) => satisfies(peer.version!, ">=4.1.0"));

        const peersThatWouldThrottle: boolean[] = await Promise.all(
            peers.map((peer) => this.communicator.wouldThrottleOnFetchingTransactions(peer)),
        );

        const peersToTry = Utils.shuffle(peers)
            .filter((_, index) => !peersThatWouldThrottle[index])
            .slice(0, 5);

        for (const peer of peersToTry) {
            try {
                const downloadedTransactions: Buffer[] = await this.communicator.getUnconfirmedTransactions(
                    peer,
                    exclude,
                );
                for (const transaction of downloadedTransactions) {
                    transactions.add(transaction.toString("hex"));
                }
            } catch {
                //
            }
        }

        const acceptedTransactions: Buffer[] = [];
        const timeNow: number = Math.ceil(Date.now() / 1000);

        for (const [id, expiryTime] of this.cachedTransactions.entries()) {
            if (timeNow - expiryTime > 30) {
                this.cachedTransactions.delete(id);
            }
        }

        for (const transaction of transactions) {
            try {
                const { data, serialised } = Transactions.TransactionFactory.fromBytesUnsafe(
                    Buffer.from(transaction, "hex"),
                );
                if (data.id && !this.cachedTransactions.has(data.id)) {
                    this.cachedTransactions.set(data.id, timeNow);
                    acceptedTransactions.push(serialised);
                }
            } catch {
                //
            }

            await delay(1);
        }

        return acceptedTransactions;
    }

    public async broadcastBlock(block: Interfaces.IBlock): Promise<void> {
        const blockchain = this.app.get<Contracts.Blockchain.Blockchain>(Container.Identifiers.BlockchainService);
        const peers: Contracts.P2P.Peer[] = this.repository.getPeers();

        let blockPing = blockchain.getBlockPing();

        if (blockPing && blockPing.block.id === block.data.id && !blockPing.fromForger) {
            const diff = blockPing.last - blockPing.first;
            if (diff < 500) {
                await Utils.sleep(500 - diff);

                blockPing = blockchain.getBlockPing()!;

                if (blockPing.block.height !== block.data.height) {
                    return;
                }
            }
        }

        this.logger.info(
            `Broadcasting block ${block.data.height.toLocaleString()} to ${Utils.pluralise(
                "peer",
                peers.length,
                true,
            )} :satellite_antenna:`,
        );

        await Promise.all(peers.map((peer) => this.communicator.postBlock(peer, block)));
    }

    public hasMinimumPeers(silent?: boolean): boolean {
        if (this.config.ignoreMinimumNetworkReach) {
            if (!silent) {
                this.logger.warning(
                    "Ignored the minimum network reach because the relay is in seed mode :exclamation:",
                );
            }

            return true;
        }

        return Object.keys(this.repository.getPeers()).length >= this.config.minimumNetworkReach;
    }

    public async populateSeedPeers(): Promise<any> {
        const peerList: Contracts.P2P.PeerData[] = this.app.config("peers").list;

        try {
            const peersFromUrl = await this.loadPeersFromUrlList();
            for (const peer of peersFromUrl) {
                if (!peerList.find((p) => p.ip === peer.ip)) {
                    peerList.push({
                        ip: peer.ip,
                        port: peer.port,
                    });
                }
            }
        } catch {}

        if (!peerList || !peerList.length) {
            this.app.terminate("No seed peers defined in peers.json :interrobang:");
        }

        const peers: Contracts.P2P.Peer[] = peerList.map((peer) => {
            const peerInstance = new Peer(peer.ip, peer.port);
            peerInstance.version = this.app.version();
            return peerInstance;
        });

        return Promise.all(
            Object.values(peers).map((peer: Contracts.P2P.Peer) => {
                this.repository.forgetPeer(peer);
                return this.app
                    .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
                    .call("validateAndAcceptPeer", { peer, options: { seed: true, lessVerbose: true } });
            }),
        );
    }

    private async pingPeerPorts(pingAll?: boolean, silent?: boolean): Promise<void> {
        let peers = this.repository.getPeers();
        if (!pingAll) {
            peers = Utils.shuffle(peers).slice(0, Math.floor(peers.length / 2));
        }

        if (!silent) {
            this.logger.debug(`Checking ports of ${Utils.pluralise("peer", peers.length, true)}`);
        }

        Promise.all(peers.map((peer) => this.communicator.pingPorts(peer)));
    }

    private async checkDNSConnectivity(options): Promise<void> {
        try {
            const host = await checkDNS(this.app, options);

            this.logger.info(`Your network connectivity has been verified by ${host} :white_check_mark:`);
        } catch (error) {
            this.logger.error(`${error.message} :bangbang:`);
        }
    }

    private async checkNTPConnectivity(options): Promise<void> {
        try {
            const { host, time } = await checkNTP(this.app, options);

            this.logger.info(`Your NTP connectivity has been verified by ${host} :white_check_mark:`);

            this.logger.info(
                `Local clock is off by ${time.t < 0 ? "-" : ""}${prettyMs(Math.abs(time.t))} from NTP :alarm_clock:`,
            );
        } catch (error) {
            this.logger.error(`${error.message} :bangbang:`);
        }
    }

    private async getDelegatesOnThisNode(): Promise<string[]> {
        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

        const height = lastBlock.data.height + 1;
        const roundInfo = Utils.roundCalculator.calculateRound(height);

        const delegates: (string | undefined)[] = (
            (await this.triggers.call("getActiveDelegates", {
                roundInfo,
            })) as Contracts.State.Wallet[]
        ).map((wallet) => wallet.getPublicKey());

        const delegatesOnThisNode: string[] = [];
        const publicKeys = Utils.getForgerDelegates();
        if (publicKeys.length > 0) {
            const { keys } = readJsonSync(`${this.app.configPath()}/delegates.json`);
            for (const key of keys) {
                const keyPair: Interfaces.IKeyPair = Identities.Keys.fromPrivateKey(key);
                if (
                    delegates.includes(keyPair.publicKey.secp256k1) &&
                    publicKeys.includes(keyPair.publicKey.secp256k1)
                ) {
                    delegatesOnThisNode.push(keyPair.publicKey.secp256k1);
                }
            }
        }
        return delegatesOnThisNode;
    }

    private async scheduleUpdateNetworkStatus(nextUpdateInSeconds): Promise<void> {
        if (this.nextUpdateNetworkStatusScheduled) {
            return;
        }

        this.nextUpdateNetworkStatusScheduled = true;

        await Utils.sleep(nextUpdateInSeconds * 1000);

        this.nextUpdateNetworkStatusScheduled = false;

        this.updateNetworkStatus();
    }

    private pingAll(): void {
        const timeNow: number = Date.now() / 1000;
        if (timeNow - this.lastPinged > 10) {
            this.cleansePeers({ fast: true, forcePing: true, log: false, skipCommonBlocks: true });
            this.lastPinged = timeNow;
        }
    }

    private async loadPeersFromUrlList(): Promise<Array<{ ip: string; port: number }>> {
        const urls: string[] = this.app.config("peers").sources || [];

        for (const url of urls) {
            // Local File...
            if (url.startsWith("/")) {
                return require(url);
            }

            // URL...
            this.logger.debug(`GET ${url}`);
            const { data } = await Utils.http.get(url);
            return typeof data === "object" ? data : JSON.parse(data);
        }

        return [];
    }
}

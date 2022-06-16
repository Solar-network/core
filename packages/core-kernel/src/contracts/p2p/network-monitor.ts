import { Interfaces } from "@solar-network/crypto";

import { NetworkState } from "./network-state";

export interface NetworkStatus {
    forked: boolean;
    blocksToRollback?: number;
}

export interface IRateLimitStatus {
    blocked: boolean;
    exceededLimitOnEndpoint: boolean;
}

export interface NetworkMonitor {
    boot(): Promise<void>;
    updateNetworkStatus(initialRun?: boolean): Promise<void>;
    cleansePeers({
        fast,
        forcePing,
        log,
        peerCount,
    }?: {
        fast?: boolean;
        forcePing?: boolean;
        log?: boolean;
        peerCount?: number;
    }): Promise<void>;
    discoverPeers(pingAll?: boolean, addAll?: boolean, silent?: boolean): Promise<boolean>;
    getAllDelegates(): Promise<string[]>;
    getDelegateName(publicKey: string): string;
    getNetworkHeight(): number;
    getNetworkState(log?: boolean): Promise<NetworkState>;
    refreshPeersAfterFork(): Promise<void>;
    checkNetworkHealth(): Promise<NetworkStatus>;
    downloadBlockAtHeight(ip: string, height: number): Promise<Interfaces.IBlockData | undefined>;
    downloadBlocksFromHeight(
        fromBlockHeight: number,
        maxParallelDownloads?: number,
        silent?: boolean,
        timeout?: number,
        checkThrottle?: boolean,
    ): Promise<Interfaces.IBlockData[]>;
    downloadTransactions(): Promise<Buffer[]>;
    broadcastBlock(block: Interfaces.IBlock): Promise<void>;
    isColdStart(): boolean;
    completeColdStart(): void;
    hasMinimumPeers(silent?: boolean): boolean;
    populateSeedPeers(): Promise<void>;
    checkForFork(): Promise<number>;
}

import { Dayjs } from "dayjs";

export interface PeerPorts {
    [name: string]: number;
}

export interface PeerPlugins {
    [name: string]: { enabled: boolean; port: number; estimateTotalCount?: boolean };
}

export interface Peer {
    readonly url: string;
    readonly port: number;

    readonly ip: string;
    readonly ports: PeerPorts;

    version: string | undefined;
    latency: number | undefined;

    infractions: Set<number>;

    lastPinged: Dayjs | undefined;
    plugins: PeerPlugins;
    publicKeys: string[];
    sequentialErrorCounter: number;
    stale: boolean;
    state: PeerState;
    verificationResult: PeerVerificationResult | undefined;

    addInfraction(): void;
    isActiveDelegate(): boolean;
    isIgnored(): boolean;
    isVerified(): boolean;
    isForked(): boolean;
    recentlyPinged(): boolean;

    toBroadcast(): PeerBroadcast;
}

export interface PeerBroadcast {
    ip: string;
    port: number;
}

export interface PeerState {
    height: number | undefined;
    forgingAllowed: boolean | undefined;
    currentSlot: number | undefined;
    header: Record<string, any>; // @todo: rename, those are block headers but the name is horrible
}

export interface PeerData {
    ip: string;
    port: number;
}

export interface PeerConfig {
    version: string;
    network: {
        version: number;
        name: string;
        nethash: string;
        explorer: string;
        token: {
            name: string;
            symbol: string;
        };
    };
    plugins: PeerPlugins;
}

export interface PeerPingResponse {
    state: PeerState;
    config: PeerConfig;
    publicKeys?: string[];
    signatures?: string[];
}

export interface PeerVerificationResult {
    readonly myHeight: number;
    readonly hisHeight: number;
    readonly highestCommonHeight: number;
    readonly forked: boolean;
}

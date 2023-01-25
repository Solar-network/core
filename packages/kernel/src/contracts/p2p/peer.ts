import { Dayjs } from "dayjs";

export interface PeerPorts {
    [name: string]: number;
}

export interface PeerPlugins {
    [name: string]: { enabled: boolean; port: number };
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
    fastVerificationResult: FastPeerVerificationResult | undefined;

    addInfraction(): void;
    isActiveBlockProducer(): boolean;
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
    allowed: boolean | undefined;
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
    readonly theirHeight: number;
    readonly highestCommonHeight: number;
    readonly forked: boolean;
}

export interface FastPeerVerificationResult {
    readonly myHeight: number;
    readonly theirHeight: number;
    readonly forked: boolean;
}

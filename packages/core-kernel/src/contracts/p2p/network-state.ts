export interface NetworkState {
    readonly status: any;

    // static analyze(monitor: NetworkMonitor, repository: PeerRepository): NetworkState;
    // static parse(data: any): NetworkState;

    canForge();

    getNodeHeight(): number | undefined;
    getLastBlockId(): string | undefined;

    getQuorum();
    getOverHeightBlockHeaders();
    setOverHeightBlockHeaders(overHeightBlockHeaders: Array<any>): void;
    toJson();
}

export interface NetworkState {
    readonly status: any;

    canProduceBlock();

    getNodeHeight(): number | undefined;
    getLastBlockId(): string | undefined;
    getLastGenerator(): string | undefined;
    getLastSlotNumber(): number | undefined;
    getQuorum();
    getOverHeightBlockHeaders();
    setOverHeightBlockHeaders(overHeightBlockHeaders: Array<any>): void;
    toJson();
}

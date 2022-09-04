import { Crypto, Interfaces } from "@solar-network/crypto";

import { Peer } from "./peer";

export interface PeerCommunicator {
    initialise();

    postBlock(peer: Peer, block: Interfaces.IBlock);

    postTransactions(peer: Peer, transactions: Buffer[]): Promise<any>;

    ping(
        peer: Peer,
        timeoutMsec: number,
        blockTimeLookup?: Crypto.GetBlockTimeStampLookup,
        force?: boolean,
        skipCommonBlocks?: boolean,
    ): Promise<any>;

    pingPorts(peer: Peer): Promise<void>;

    getPeers(peer: Peer, silent?: boolean): Promise<any>;

    hasCommonBlocks(peer: Peer, ids: string[], timeoutMsec?: number): Promise<any>;

    getPeerBlocks(
        peer: Peer,
        {
            fromBlockHeight,
            blockLimit,
            headersOnly,
        }: { fromBlockHeight: number; blockLimit?: number; headersOnly?: boolean },
    ): Promise<Interfaces.IBlockData[]>;

    getUnconfirmedTransactions(peer: Peer, exclude: string[]): Promise<Buffer[]>;

    wouldThrottleOnDownload(peer: Peer): Promise<boolean>;

    wouldThrottleOnFetchingPeers(peer: Peer): Promise<boolean>;

    wouldThrottleOnFetchingTransactions(peer: Peer): Promise<boolean>;
}

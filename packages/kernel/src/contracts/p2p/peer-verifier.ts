import { FastPeerVerificationResult, Peer, PeerState, PeerVerificationResult } from "./peer";

export interface PeerVerifier {
    initialise(peer: Peer);

    checkState(claimedState: PeerState, deadline: number): Promise<PeerVerificationResult | undefined>;

    checkStateFast(claimedState: PeerState, deadline: number): Promise<FastPeerVerificationResult | undefined>;
}

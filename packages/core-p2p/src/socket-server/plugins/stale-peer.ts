import { Container, Contracts } from "@solar-network/core-kernel";

import { Socket } from "../../hapi-nes/socket";

@Container.injectable()
export class StalePeerPlugin {
    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly peerRepository!: Contracts.P2P.PeerRepository;

    public register(socket: Socket): void {
        if (socket && socket.info && this.peerRepository.hasPeer(socket.info.remoteAddress)) {
            const peer: Contracts.P2P.Peer = this.peerRepository.getPeer(socket.info.remoteAddress);
            peer.stale = true;
        }
    }
}

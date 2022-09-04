import { Container, Contracts } from "@solar-network/kernel";

import { BlocksRoute } from "../routes/blocks";
import { PeerRoute } from "../routes/peer";
import { TransactionsRoute } from "../routes/transactions";

@Container.injectable()
export class VersionPlugin {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly peerRepository!: Contracts.P2P.PeerRepository;

    public register(server): void {
        const routesConfigByPath = {
            ...this.app.resolve(PeerRoute).getRoutesConfigByPath(),
            ...this.app.resolve(BlocksRoute).getRoutesConfigByPath(),
            ...this.app.resolve(TransactionsRoute).getRoutesConfigByPath(),
        };

        server.ext({
            type: "onPostAuth",
            method: async (request, h) => {
                if (routesConfigByPath[request.path]) {
                    const peerIp = request.info.remoteAddress;
                    const version = request.payload?.headers?.version;
                    if (version && this.peerRepository.hasPeer(peerIp)) {
                        const peer = this.peerRepository.getPeer(peerIp);
                        peer.version = version;
                    }
                }
                return h.continue;
            },
        });
    }
}

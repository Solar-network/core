import { Container, Contracts, Providers, Utils } from "@solar-network/core-kernel";
import { Interfaces, Transactions } from "@solar-network/crypto";

import { PeerCommunicator } from "./peer-communicator";

@Container.injectable()
export class TransactionBroadcaster implements Contracts.P2P.TransactionBroadcaster {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/core-p2p")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly repository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.PeerCommunicator)
    private readonly communicator!: PeerCommunicator;

    public async broadcastTransactions(transactions: Interfaces.ITransaction[]): Promise<void> {
        if (transactions.length === 0) {
            this.logger.warning("Broadcasting 0 transactions");
            return;
        }

        const maxPeersBroadcast: number = this.configuration.getRequired<number>("maxPeersBroadcast");
        const peers: Contracts.P2P.Peer[] = Utils.take(Utils.shuffle(this.repository.getPeers()), maxPeersBroadcast);

        const transactionsStr = Utils.pluralize("transaction", transactions.length, true);
        const peersStr = Utils.pluralize("peer", peers.length, true);
        this.logger.debug(`Broadcasting ${transactionsStr} to ${peersStr} :moneybag:`);

        const transactionsBroadcast: Buffer[] = transactions.map((t) => Transactions.Serializer.serialize(t));
        const promises = peers.map((p) => this.communicator.postTransactions(p, transactionsBroadcast));

        await Promise.all(promises);
    }
}

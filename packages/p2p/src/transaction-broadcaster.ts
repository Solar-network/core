import { Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Providers, Utils } from "@solar-network/kernel";

import { PeerCommunicator } from "./peer-communicator";

@Container.injectable()
export class TransactionBroadcaster implements Contracts.P2P.TransactionBroadcaster {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly repository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.PeerCommunicator)
    private readonly communicator!: PeerCommunicator;

    public async broadcastTransactions(transactions: Interfaces.ITransaction[]): Promise<void> {
        if (transactions.length === 0) {
            return;
        }

        const peers: Contracts.P2P.Peer[] = this.repository.getPeers();

        const peersStr = Utils.pluralise("peer", peers.length, true);

        const maxTransactions: number = this.app
            .getTagged<Providers.PluginConfiguration>(
                Container.Identifiers.PluginConfiguration,
                "plugin",
                "@solar-network/pool",
            )
            .getOptional<number>("maxTransactionsPerRequest", 40);
        const transactionBatches: Interfaces.ITransaction[][] = Utils.chunk(transactions, maxTransactions);

        for (const batch of transactionBatches) {
            const transactionsStr = Utils.pluralise("transaction", batch.length, true);
            this.logger.debug(`Broadcasting ${transactionsStr} to ${peersStr}`, "📡");

            const transactionsBroadcast: Buffer[] = batch.map((t) => Transactions.Serialiser.serialise(t));
            const promises = peers.map((p) => this.communicator.postTransactions(p, transactionsBroadcast));

            await Promise.all(promises);
        }
    }
}

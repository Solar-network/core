import { Container, Contracts, Utils } from "@solar-network/core-kernel";
import { Interfaces, Transactions } from "@solar-network/crypto";

import { PeerCommunicator } from "./peer-communicator";

@Container.injectable()
export class TransactionBroadcaster implements Contracts.P2P.TransactionBroadcaster {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly repository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.PeerCommunicator)
    private readonly communicator!: PeerCommunicator;

    public async broadcastTransactions(transactions: Interfaces.ITransaction[]): Promise<void> {
        if (transactions.length === 0) {
            this.logger.warning("Broadcasting 0 transactions");
            return;
        }

        const peers: Contracts.P2P.Peer[] = this.repository.getPeers();

        const transactionsStr = Utils.pluralise("transaction", transactions.length, true);
        const peersStr = Utils.pluralise("peer", peers.length, true);
        this.logger.debug(`Broadcasting ${transactionsStr} to ${peersStr} :moneybag:`);

        const transactionsBroadcast: Buffer[] = transactions.map((t) => Transactions.Serialiser.serialise(t));
        const promises = peers.map((p) => this.communicator.postTransactions(p, transactionsBroadcast));

        await Promise.all(promises);
    }
}

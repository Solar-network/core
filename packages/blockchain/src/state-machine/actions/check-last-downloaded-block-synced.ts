import { Managers } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class CheckLastDownloadedBlockSynced implements Action {
    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "blockchain")
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    public async handle(): Promise<void> {
        const epoch = Math.floor(new Date(Managers.configManager.getMilestone(1).epoch).getTime() / 1000);
        if (Math.floor(Date.now() / 1000) <= epoch) {
            this.blockchain.dispatch("SYNCED");
            return;
        }

        let event = "NOTSYNCED";

        if (this.blockchain.getQueue().size() > 100) {
            event = "PAUSED";
        }

        // tried to download but no luck after 3 tries (looks like network may be halted)
        if (this.stateStore.getNoBlockCounter() > 3 && !this.blockchain.getQueue().isRunning()) {
            this.logger.info("Tried to sync 3 times to different nodes, looks like the network may be halted", "☂️");

            this.stateStore.setNoBlockCounter(0);
            event = "NETWORKHALTED";

            if (this.stateStore.getP2pUpdateCounter() + 1 > 2) {
                this.logger.info("Network is not producing blocks", "☔");

                const networkStatus = await this.networkMonitor.checkNetworkHealth();

                if (networkStatus.forked) {
                    this.stateStore.setNumberOfBlocksToRollback(networkStatus.blocksToRollback!);
                    event = "FORK";
                }

                this.stateStore.setP2pUpdateCounter(0);
            } else {
                this.stateStore.setP2pUpdateCounter(this.stateStore.getP2pUpdateCounter() + 1);
            }
        } else if (
            this.stateStore.getLastDownloadedBlock() &&
            this.blockchain.isSynced(this.stateStore.getLastDownloadedBlock())
        ) {
            this.stateStore.setNoBlockCounter(0);
            this.stateStore.setP2pUpdateCounter(0);

            event = "SYNCED";
        }

        if (this.stateStore.getNetworkStart()) {
            event = "SYNCED";
        }

        if (process.env.SOLAR_CORE_ENV === "test") {
            event = "TEST";
        }

        this.blockchain.dispatch(event);
    }
}

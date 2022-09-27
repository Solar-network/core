import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class StartForkRecovery implements Action {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly database!: DatabaseService;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    public async handle(): Promise<void> {
        if (this.blockchain.isForking()) {
            return;
        }

        const random: number = 4 + Math.floor(Math.random() * 99); // random int inside [4, 102] range
        const blocksToRemove: number = this.stateStore.getNumberOfBlocksToRollback() || random;

        if (blocksToRemove > 0) {
            const queue: Contracts.Kernel.Queue = this.blockchain.getQueue();

            this.blockchain.setForkingState(true);
            this.logger.info("Starting fork recovery", "🍴");

            await queue.stop();

            await this.blockchain.removeBlocks(blocksToRemove);

            await queue.clear();
            const lastStoredBlock = await this.database.getLastBlock();
            this.stateStore.setLastDownloadedBlock(lastStoredBlock.data);

            this.stateStore.setNumberOfBlocksToRollback(0);
            this.logger.info(`Removed ${AppUtils.pluralise("block", blocksToRemove, true)}`, "🧹");

            await this.roundState.restore();

            this.blockchain.setForkingState(false);

            await queue.resume();

            await this.networkMonitor.refreshPeersAfterFork();
        }

        this.blockchain.dispatch("SUCCESS");
    }
}

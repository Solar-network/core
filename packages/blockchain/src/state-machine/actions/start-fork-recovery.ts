import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class StartForkRecovery implements Action {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    public async handle(): Promise<void> {
        this.logger.info("Starting fork recovery :fork_and_knife:");

        this.blockchain.clearAndStopQueue();

        const random: number = 4 + Math.floor(Math.random() * 99); // random int inside [4, 102] range
        const blocksToRemove: number = this.stateStore.getNumberOfBlocksToRollback() || random;

        await this.blockchain.removeBlocks(blocksToRemove);

        this.stateStore.setNumberOfBlocksToRollback(0);

        this.logger.info(`Removed ${AppUtils.pluralise("block", blocksToRemove, true)} :wastebasket:`);

        await this.roundState.restore();

        await this.networkMonitor.refreshPeersAfterFork();

        this.blockchain.dispatch("SUCCESS");
        await this.blockchain.getQueue().resume();
    }
}

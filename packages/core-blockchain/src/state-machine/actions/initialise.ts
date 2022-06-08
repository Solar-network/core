import { DatabaseService } from "@solar-network/core-database";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { DatabaseInteraction } from "@solar-network/core-state";
import { Interfaces, Managers } from "@solar-network/crypto";

import { Action } from "../contracts";

@Container.injectable()
export class Initialise implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.TransactionPoolService)
    private readonly transactionPool!: Contracts.TransactionPool.Service;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.DatabaseInteraction)
    private readonly databaseInteraction!: DatabaseInteraction;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    public async handle(): Promise<void> {
        try {
            const block: Interfaces.IBlock = this.stateStore.getLastBlock();
            this.logger.info(`Last block in database: ${block.data.height.toLocaleString()}`);

            const loadedState: boolean = await this.app
                .get<Contracts.State.StateLoader>(Container.Identifiers.StateLoader)
                .run();

            if (!loadedState) {
                if (!this.stateStore.getRestoredDatabaseIntegrity()) {
                    this.logger.info("Verifying database integrity :hourglass_flowing_sand:");

                    if (!(await this.databaseService.verifyBlockchain())) {
                        return this.blockchain.dispatch("ROLLBACK");
                    }

                    this.logger.info("Verified database integrity :smile_cat:");
                } else {
                    this.logger.info(
                        "Skipping database integrity check after successful database recovery :smile_cat:",
                    );
                }
            }

            // only genesis block? special case of first round needs to be dealt with
            if (block.data.height === 1) {
                if (block.data.payloadHash !== Managers.configManager.get("network.nethash")) {
                    this.logger.error(
                        "FATAL: The genesis block payload hash is different from the configured nethash :rotating_light:",
                    );

                    return this.blockchain.dispatch("FAILURE");
                }

                await this.databaseService.deleteRound(1);
            }

            /** *******************************
             *  state machine data init      *
             ******************************* */
            // Delete all rounds from the future due to shutdown before processBlocks finished writing the blocks.
            const roundInfo = AppUtils.roundCalculator.calculateRound(block.data.height);
            await this.databaseService.deleteRound(roundInfo.round + 1);

            if (this.stateStore.getNetworkStart()) {
                if (!loadedState) {
                    await this.app.get<Contracts.State.StateBuilder>(Container.Identifiers.StateBuilder).run();
                }
                await this.databaseInteraction.restoreCurrentRound();
                await this.transactionPool.readdTransactions();
                await this.networkMonitor.boot();

                return this.blockchain.dispatch("STARTED");
            }

            if (process.env.NODE_ENV === "test") {
                this.logger.notice("TEST SUITE DETECTED! SYNCING WALLETS AND STARTING IMMEDIATELY :bangbang:");

                if (!loadedState) {
                    await this.app.get<Contracts.State.StateBuilder>(Container.Identifiers.StateBuilder).run();
                }
                await this.databaseInteraction.restoreCurrentRound();
                await this.networkMonitor.boot();

                return this.blockchain.dispatch("STARTED");
            }

            /** *******************************
             * database init                 *
             ******************************* */
            // Integrity Verification

            if (!loadedState) {
                await this.app.get<Contracts.State.StateBuilder>(Container.Identifiers.StateBuilder).run();
            }
            await this.databaseInteraction.restoreCurrentRound();
            await this.transactionPool.readdTransactions();

            await this.networkMonitor.boot();

            return this.blockchain.dispatch("STARTED");
        } catch (error) {
            this.logger.error(error.stack);

            return this.blockchain.dispatch("FAILURE");
        }
    }
}

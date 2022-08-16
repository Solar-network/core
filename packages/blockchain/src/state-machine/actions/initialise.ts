import { Crypto, Interfaces, Managers } from "@solar-network/crypto";
import { DatabaseService, Repositories } from "@solar-network/database";
import { Container, Contracts, Services, Utils as AppUtils, Utils } from "@solar-network/kernel";
import { DatabaseInteraction } from "@solar-network/state";
import { existsSync, unlinkSync } from "fs";

import { Action } from "../contracts";

@Container.injectable()
export class Initialise implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: Repositories.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseMissedBlockRepository)
    private readonly missedBlockRepository!: Repositories.MissedBlockRepository;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.PoolService)
    private readonly pool!: Contracts.Pool.Service;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.DatabaseInteraction)
    private readonly databaseInteraction!: DatabaseInteraction;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async handle(): Promise<void> {
        try {
            const block: Interfaces.IBlock = this.stateStore.getLastBlock();
            this.logger.info(`Last block in database: ${block.data.height.toLocaleString()}`);

            const loadedState: boolean = await this.app
                .get<Contracts.State.StateLoader>(Container.Identifiers.StateLoader)
                .run();

            const forceIntegrityCheckLock: string = `${process.env.CORE_PATH_TEMP}/force-integrity-check.lock`;
            let forceIntegrityCheck: boolean = false;

            if (existsSync(forceIntegrityCheckLock)) {
                try {
                    unlinkSync(forceIntegrityCheckLock);
                } catch {
                    //
                }
                forceIntegrityCheck = true;
            }

            if (!loadedState || forceIntegrityCheck) {
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
                if (!(await this.calculateMissedBlocks())) {
                    return;
                }
                await this.databaseInteraction.restoreCurrentRound();
                await this.pool.readdTransactions();
                await this.networkMonitor.boot();

                return this.blockchain.dispatch("STARTED");
            }

            if (process.env.NODE_ENV === "test") {
                this.logger.notice("TEST SUITE DETECTED! SYNCING WALLETS AND STARTING IMMEDIATELY :bangbang:");

                if (!loadedState) {
                    await this.app.get<Contracts.State.StateBuilder>(Container.Identifiers.StateBuilder).run();
                }
                if (!(await this.calculateMissedBlocks())) {
                    return;
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

            if (!(await this.calculateMissedBlocks())) {
                return;
            }
            await this.databaseInteraction.restoreCurrentRound();
            await this.pool.readdTransactions();

            await this.networkMonitor.boot();

            return this.blockchain.dispatch("STARTED");
        } catch (error) {
            this.logger.error(error.stack);

            return this.blockchain.dispatch("FAILURE");
        }
    }

    private async calculateMissedBlocks(): Promise<boolean> {
        if (await this.missedBlockRepository.hasMissedBlocks()) {
            return true;
        }

        this.logger.info("Calculating productivity data, this might take a while :abacus:");

        const chunkSize = 10000;

        const chunks = this.stateStore.getLastBlock().data.height / chunkSize;

        const missedBlocks: { timestamp: number; height: number; username: string }[] = [];
        const calculatedRounds = {};

        for (let i = 0; i < chunks; i++) {
            const offset = i * chunkSize + 1;
            const blocks = await this.blockRepository.findByHeightRange(offset, offset + chunkSize - 1);
            for (let j = 0; j < blocks.length; j++) {
                const block: Interfaces.IBlockData = blocks[j];

                if (block.height === 1) {
                    continue;
                }

                const round = Utils.roundCalculator.calculateRound(block.height);
                const { blockTime } = Managers.configManager.getMilestone(round.roundHeight);
                if (!calculatedRounds[round.round]) {
                    const delegatesInThisRound: Contracts.State.Wallet[] = (await this.app
                        .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
                        .call("getActiveDelegates", { roundInfo: round }))!;
                    calculatedRounds[round.round] = delegatesInThisRound.map((delegate) =>
                        delegate.getAttribute("delegate.username"),
                    );
                    if (!calculatedRounds[round.round].length) {
                        const rollbackHeight: number = round.roundHeight - round.maxDelegates;
                        this.logger.error("The database is corrupted :fire:");
                        this.logger.error(
                            `Attempting recovery by rolling back to height ${rollbackHeight.toLocaleString()}`,
                        );
                        await this.blockRepository.deleteTopBlocks(
                            this.app,
                            this.stateStore.getLastBlock().data.height - rollbackHeight,
                        );
                        const lastBlock = await this.databaseService.getLastBlock();
                        this.stateStore.setLastBlock(lastBlock);
                        this.stateStore.setLastStoredBlockHeight(lastBlock.data.height);
                        this.walletRepository.reset();
                        this.handle();
                        return false;
                    }
                }

                const delegates = calculatedRounds[round.round];
                const lastBlock: Interfaces.IBlockData = (
                    j > 0 ? blocks[j - 1] : await this.blockRepository.findByHeight(block.height - 1)
                )!;
                const thisSlot: number = Crypto.Slots.getSlotNumber(
                    await Utils.forgingInfoCalculator.getBlockTimeLookup(this.app, block.height),
                    block.timestamp,
                );
                const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(
                    this.app,
                    lastBlock.height,
                );
                const lastSlot: number = lastBlock
                    ? Crypto.Slots.getSlotNumber(blockTimeLookup, lastBlock.timestamp) + 1
                    : 0;
                const missedSlots: number = thisSlot - lastSlot;
                if (missedSlots > 0) {
                    let missedSlotCounter: number = 0;
                    for (let slotCounter = lastSlot; slotCounter < thisSlot; slotCounter++) {
                        missedSlotCounter++;
                        missedBlocks.push({
                            height: block.height,
                            username: delegates[slotCounter % delegates.length],
                            timestamp:
                                Crypto.Slots.getSlotTime(
                                    blockTimeLookup,
                                    Crypto.Slots.getSlotNumber(blockTimeLookup, lastBlock.timestamp),
                                ) +
                                blockTime * missedSlotCounter,
                        });
                    }
                }
            }
        }

        await this.missedBlockRepository.addMissedBlocks(missedBlocks);
        return true;
    }
}

import { Blocks, Crypto, Interfaces, Managers } from "@solar-network/crypto";
import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Enums, Providers, Types, Utils } from "@solar-network/kernel";
import { DatabaseInteraction } from "@solar-network/state";

import { ProcessBlocksJob } from "./process-blocks-job";
import { StateMachine } from "./state-machine";
import { blockchainMachine } from "./state-machine/machine";

@Container.injectable()
export class Blockchain implements Contracts.Blockchain.Blockchain {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/blockchain")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.DatabaseInteraction)
    private readonly databaseInteraction!: DatabaseInteraction;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly database!: DatabaseService;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: Contracts.Database.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseBlockProductionFailureRepository)
    private readonly blockProductionFailureRepository!: Contracts.Database.BlockProductionFailureRepository;

    @Container.inject(Container.Identifiers.PoolService)
    private readonly pool!: Contracts.Pool.Service;

    @Container.inject(Container.Identifiers.StateMachine)
    private readonly stateMachine!: StateMachine;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly peerRepository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    private queue!: Contracts.Kernel.Queue;

    private stopped!: boolean;
    private booted: boolean = false;
    private forkCheck: boolean = false;
    private forking: boolean = false;
    private blockProductionFailures: number = 0;
    private lastCheckNetworkHealthTs: number = 0;
    private lastCheckForkTs: number = 0;
    private lastUpdatedBlockId: string | undefined;
    private updating: boolean = false;

    @Container.postConstruct()
    public async initialise(): Promise<void> {
        this.stopped = false;

        // flag to force a network start
        this.stateStore.setNetworkStart(this.configuration.getOptional("options.networkStart", false));

        this.queue = await this.app.get<Types.QueueFactory>(Container.Identifiers.QueueFactory)();

        const stateSaver: Contracts.State.StateSaver = this.app.get<Contracts.State.StateSaver>(
            Container.Identifiers.StateSaver,
        );

        this.queue.on("drain", async () => {
            this.database.checkpoint();
            this.updateReliability(false);
            this.pool.readdTransactions(undefined, true);
            await stateSaver.run();
            this.dispatch("PROCESSFINISHED");
        });

        this.queue.on("jobError", (job, error) => {
            const blocks = (job as ProcessBlocksJob).getBlocks();

            this.logger.error(
                `Failed to process ${Utils.pluralise(
                    "block",
                    blocks.length,
                    true,
                )} from height ${blocks[0].height.toLocaleString()} in queue`,
            );
        });
    }

    /**
     * Determine if the blockchain is stopped.
     */
    public isStopped(): boolean {
        return this.stopped;
    }

    public isBooted(): boolean {
        return this.booted;
    }

    public isForking(): boolean {
        return this.forking;
    }

    public getQueue(): Contracts.Kernel.Queue {
        return this.queue;
    }

    /**
     * Dispatch an event to transition the state machine.
     * @param {String} event
     * @return {void}
     */
    public dispatch(event: string): void {
        return this.stateMachine.transition(event);
    }

    /**
     * Start the blockchain and wait for it to be ready.
     * @return {void}
     */
    public async boot(skipStartedCheck = false): Promise<boolean> {
        this.stateStore.reset(blockchainMachine);

        this.dispatch("START");

        if (skipStartedCheck || process.env.SOLAR_CORE_SKIP_BLOCKCHAIN_STARTED_CHECK?.toLowerCase() === "true") {
            return true;
        }

        while (!this.stateStore.isStarted() && !this.stopped) {
            await Utils.sleep(1000);
        }

        await this.networkMonitor.cleansePeers({
            forcePing: true,
            peerCount: 10,
        });

        this.events.listen(Enums.BlockProducerEvent.Failed, { handle: this.checkNoBlocks });

        this.events.listen(Enums.RoundEvent.Applied, { handle: this.resetBlockProductionFailures });

        this.updateReliability(true);

        this.booted = true;

        return true;
    }

    public async dispose(): Promise<void> {
        if (!this.stopped) {
            this.stopped = true;
            this.stateStore.clearWakeUpTimeout();

            this.dispatch("STOP");

            await this.queue.stop();
        }
    }

    public setForkingState(forking: boolean): void {
        this.forking = forking;
    }

    /**
     * Set wakeup timeout to check the network for new blocks.
     */
    public setWakeUp(): void {
        this.stateStore.setWakeUpTimeout(() => {
            this.dispatch("WAKEUP");
        }, 60000);
    }

    /**
     * Reset the wakeup timeout.
     */
    public resetWakeUp(): void {
        this.stateStore.clearWakeUpTimeout();
        this.setWakeUp();
    }

    /**
     * Clear and stop the queue.
     * @return {void}
     */
    public clearAndStopQueue(): void {
        this.stateStore.setLastDownloadedBlock(this.getLastBlock().data);

        this.queue.pause();
        this.clearQueue();
    }

    /**
     * Clear the queue.
     * @return {void}
     */
    public clearQueue(): void {
        this.queue.clear();
    }

    /**
     * Push a block to the process queue.
     */
    public async handleIncomingBlock(
        block: Interfaces.IBlockData,
        fromOurNode = false,
        ip: string,
        fireBlockReceivedEvent = true,
    ): Promise<void> {
        const blockTimeLookup = await Utils.blockProductionInfoCalculator.getBlockTimeLookup(this.app, block.height);

        const currentSlot: number = Crypto.Slots.getSlotNumber(blockTimeLookup);
        const receivedSlot: number = Crypto.Slots.getSlotNumber(blockTimeLookup, block.timestamp);

        if (fromOurNode) {
            const minimumMs: number = 2000;
            const timeLeftInMs: number = Crypto.Slots.getTimeInMsUntilNextSlot(blockTimeLookup);
            if (currentSlot !== receivedSlot || timeLeftInMs < minimumMs) {
                this.logger.info(
                    `Discarded block ${block.height.toLocaleString()} because it was received too late`,
                    "❗",
                );
                return;
            }
        }

        if (receivedSlot > currentSlot) {
            return;
        }

        this.setBlockUsername(block);
        this.pushPingBlock(block, fromOurNode);

        if (this.stateStore.isStarted()) {
            block.fromOurNode = fromOurNode;
            this.dispatch("NEWBLOCK");
            this.enqueueBlocks([block]);

            if (fireBlockReceivedEvent) {
                this.events.dispatch(Enums.BlockEvent.Received, { ...Blocks.Block.getBasicHeader(block), ip });
            }
        } else {
            this.logger.info(`Block disregarded because blockchain is not ready`, "❗");

            this.events.dispatch(Enums.BlockEvent.Disregarded, { ...Blocks.Block.getBasicHeader(block), ip });
        }
    }

    /**
     * Enqueue blocks in process queue and set last downloaded block to last item in list.
     */
    public enqueueBlocks(blocks: Interfaces.IBlockData[]): void {
        if (blocks.length === 0) {
            return;
        }

        const __createQueueJob = (blocks: Interfaces.IBlockData[]) => {
            const processBlocksJob = this.app.resolve<ProcessBlocksJob>(ProcessBlocksJob);
            processBlocksJob.setBlocks(blocks);

            this.queue.push(processBlocksJob);
            if (!this.isForking()) {
                this.queue.resume();
            }
        };

        const lastDownloadedHeight: number = this.getLastDownloadedBlock().height;
        const milestoneHeights: number[] = Managers.configManager
            .getMilestones()
            .map((milestone) => milestone.height)
            .sort((a, b) => a - b)
            .filter((height) => height >= lastDownloadedHeight);

        // divide blocks received into chunks depending on number of transactions
        // this is to avoid blocking the application when processing "heavy" blocks
        let currentBlocksChunk: any[] = [];
        let currentTransactionsCount = 0;
        for (const block of blocks) {
            Utils.assert.defined<Interfaces.IBlockData>(block);
            this.setBlockUsername(block);
            currentBlocksChunk.push(block);
            currentTransactionsCount += block.numberOfTransactions;

            const nextMilestone = milestoneHeights[0] && milestoneHeights[0] === block.height;

            if (
                currentTransactionsCount >= 150 ||
                currentBlocksChunk.length >= Math.min(this.stateStore.getMaxLastBlocks(), 100) ||
                nextMilestone
            ) {
                __createQueueJob(currentBlocksChunk);
                currentBlocksChunk = [];
                currentTransactionsCount = 0;
                if (nextMilestone) {
                    milestoneHeights.shift();
                }
            }
        }
        __createQueueJob(currentBlocksChunk);
    }

    /**
     * Remove N number of blocks.
     * @param {number} blockCount
     * @return {void}
     */
    public async removeBlocks(blockCount: number): Promise<void> {
        try {
            const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

            // If the current chain height is H and we will be removing blocks [N, H],
            // then blocksToRemove[] will contain blocks [N - 1, H - 1].
            const blocksToRemove: Interfaces.IBlockData[] = await this.database.getBlocks(
                lastBlock.data.height - blockCount,
                lastBlock.data.height,
            );

            const removedBlocks: Interfaces.IBlockData[] = [];
            const removedTransactions: Interfaces.ITransaction[] = [];

            const revertLastBlock = async () => {
                const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

                await this.databaseInteraction.revertBlock(lastBlock);
                removedBlocks.push(lastBlock.data);
                removedTransactions.push(...[...lastBlock.transactions].reverse());
                blocksToRemove.pop();

                let newLastBlock: Interfaces.IBlock;
                if (blocksToRemove[blocksToRemove.length - 1].height === 1) {
                    newLastBlock = this.stateStore.getGenesisBlock();
                } else {
                    const tempNewLastBlockData: Interfaces.IBlockData = blocksToRemove[blocksToRemove.length - 1];

                    Utils.assert.defined<Interfaces.IBlockData>(tempNewLastBlockData);

                    const tempNewLastBlock: Interfaces.IBlock | undefined = Blocks.BlockFactory.fromData(
                        tempNewLastBlockData,
                        {
                            deserialiseTransactionsUnchecked: true,
                        },
                    );

                    Utils.assert.defined<Interfaces.IBlockData>(tempNewLastBlock);

                    newLastBlock = tempNewLastBlock;
                }

                this.stateStore.setLastBlock(newLastBlock);
                this.stateStore.setLastDownloadedBlock(newLastBlock.data);
            };

            const __removeBlocks = async (numberOfBlocks) => {
                if (numberOfBlocks < 1) {
                    return;
                }

                const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

                this.logger.info(`Undoing block ${lastBlock.data.height.toLocaleString()}`, "🗑️");

                await revertLastBlock();
                await __removeBlocks(numberOfBlocks - 1);
            };

            if (blockCount >= lastBlock.data.height) {
                blockCount = lastBlock.data.height - 1;
            }

            if (blockCount < 1) {
                return;
            }

            this.clearAndStopQueue();

            const resetHeight: number = lastBlock.data.height - blockCount;
            this.logger.warning(
                `Removing ${Utils.pluralise(
                    "block",
                    blockCount,
                    true,
                )} - reset to height ${resetHeight.toLocaleString()}`,
            );

            this.stateStore.setLastDownloadedBlock(lastBlock.data);

            await __removeBlocks(blockCount);

            await this.blockRepository.delete(removedBlocks.reverse());
            this.stateStore.setLastStoredBlockHeight(lastBlock.data.height - blockCount);

            await this.pool.readdTransactions(removedTransactions.reverse());

            // Validate last block
            const lastStoredBlock = await this.database.getLastBlock();

            if (lastStoredBlock.data.id !== this.stateStore.getLastBlock().data.id) {
                throw new Error(
                    `Last stored block (${lastStoredBlock.data.id}) is not the same as last block from state store (${
                        this.stateStore.getLastBlock().data.id
                    })`,
                );
            }
        } catch (err) {
            this.logger.critical(err.stack);
            this.logger.critical("Shutting down app, because state might be corrupted");
            process.exit(1);
        }
    }

    /**
     * Remove the top blocks from database.
     * NOTE: Only used when trying to restore database integrity or loading an earlier saved state.
     * @param {number} count
     * @return {void}
     */
    public async removeTopBlocks(count: number): Promise<void> {
        await this.blockRepository.deleteTop(count);
    }

    /**
     * Reset the last downloaded block to last chained block.
     */
    public resetLastDownloadedBlock(): void {
        this.stateStore.setLastDownloadedBlock(this.getLastBlock().data);
    }

    /**
     * Called by producer to wake up and sync with the network.
     * It clears the wakeUpTimeout if set.
     */
    public forceWakeup(): void {
        this.stateStore.clearWakeUpTimeout();

        this.dispatch("WAKEUP");
    }

    /**
     * Fork the chain at the given block.
     */
    public forkBlock(block: Interfaces.IBlock, numberOfBlocksToRollback?: number): void {
        if (numberOfBlocksToRollback && numberOfBlocksToRollback < 0) {
            return;
        }

        this.stateStore.setForkedBlock(block);

        this.clearAndStopQueue();

        if (numberOfBlocksToRollback) {
            this.stateStore.setNumberOfBlocksToRollback(numberOfBlocksToRollback);
        }

        this.dispatch("FORK");
    }

    /**
     * Determine if the blockchain is synced.
     */
    public isSynced(block?: Interfaces.IBlockData): boolean {
        if (!this.peerRepository.hasPeers()) {
            return true;
        }

        block = block || this.getLastBlock().data;

        return (
            Crypto.Slots.getTime() - block.timestamp < 3 * Managers.configManager.getMilestone(block.height).blockTime
        );
    }

    public isCheckingForFork(): boolean {
        return this.forkCheck;
    }

    /**
     * Get the last block of the blockchain.
     */
    public getLastBlock(): Interfaces.IBlock {
        return this.stateStore.getLastBlock();
    }

    /**
     * Get the last height of the blockchain.
     */
    public getLastHeight(): number {
        return this.getLastBlock().data.height;
    }

    /**
     * Get the last downloaded block of the blockchain.
     */
    public getLastDownloadedBlock(): Interfaces.IBlockData {
        return this.stateStore.getLastDownloadedBlock() || this.getLastBlock().data;
    }

    /**
     * Get the block ping.
     */
    public getBlockPing(): Contracts.State.BlockPing | undefined {
        return this.stateStore.getBlockPing();
    }

    /**
     * Ping a block.
     */
    public pingBlock(incomingBlock: Interfaces.IBlockData): boolean {
        return this.stateStore.pingBlock(incomingBlock);
    }

    /**
     * Push ping block.
     */
    public pushPingBlock(block: Interfaces.IBlockData, fromOurNode = false): void {
        this.stateStore.pushPingBlock(block, fromOurNode);
    }

    /**
     * Check if the blockchain should roll back due to receiving no blocks.
     */
    public async checkNoBlocks(): Promise<void> {
        this.blockProductionFailures++;
        if (
            this.blockProductionFailures >= Managers.configManager.getMilestone().activeBlockProducers / 3 - 1 &&
            Math.random() <= 0.8
        ) {
            this.resetBlockProductionFailures();

            // do not check network health here more than every 10 minutes
            const nowTs = Date.now();
            if (nowTs - this.lastCheckNetworkHealthTs < 10 * 60 * 1000) {
                return;
            }
            this.lastCheckNetworkHealthTs = nowTs;

            const networkStatus = await this.networkMonitor.checkNetworkHealth();

            if (networkStatus.forked) {
                this.stateStore.setNumberOfBlocksToRollback(networkStatus.blocksToRollback!);
                this.dispatch("FORK");
            }
        }
    }

    public async checkForFork(blocks: Interfaces.IBlockData[]): Promise<boolean> {
        const milestone = Managers.configManager.getMilestone();
        const timeNow: number = Date.now() / 1000;

        if (!this.isForking() && timeNow - this.lastCheckForkTs > milestone.blockTime) {
            this.lastCheckForkTs = timeNow;
            this.forkCheck = true;
            const rollbackBlocks: number = await this.networkMonitor.checkForFork();
            if (rollbackBlocks > 0) {
                this.setForkingState(true);
                await this.queue.stop();

                await this.removeBlocks(rollbackBlocks);

                await this.queue.clear();
                const lastStoredBlock = await this.database.getLastBlock();
                this.stateStore.setLastDownloadedBlock(lastStoredBlock.data);

                this.stateStore.setNumberOfBlocksToRollback(0);
                this.logger.info(`Removed ${Utils.pluralise("block", rollbackBlocks, true)}`, "🗑️");

                await this.roundState.restore();

                this.setForkingState(false);

                await this.queue.resume();
                try {
                    if (blocks[0].ip) {
                        const forkedBlock: Interfaces.IBlockData | undefined =
                            await this.networkMonitor.downloadBlockAtHeight(blocks[0].ip, blocks[0].height - 1);
                        if (forkedBlock) {
                            const blocksToEnqueue: Interfaces.IBlockData[] = [forkedBlock, ...blocks];
                            this.stateStore.setLastDownloadedBlock(blocksToEnqueue[blocksToEnqueue.length - 1]);
                            this.dispatch("NEWBLOCK");
                            this.enqueueBlocks(blocksToEnqueue);
                        }
                    }
                } catch {
                    //
                }
                this.forkCheck = false;
                return true;
            }

            this.forkCheck = false;
        }

        return false;
    }

    public setBlockUsername(block: Interfaces.IBlockData): void {
        if (block.version === 0 && !block.username) {
            if (this.walletRepository.hasByPublicKey(block.generatorPublicKey)) {
                const generatorWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
                    block.generatorPublicKey,
                );

                if (generatorWallet.hasAttribute("username")) {
                    block.username = generatorWallet.getAttribute("username");
                }
            }

            if (block.username === null) {
                delete block.username;
            }
        }
    }

    private resetBlockProductionFailures(): void {
        this.blockProductionFailures = 0;
    }

    private async updateReliability(initialStart: boolean): Promise<void> {
        if (this.updating || this.getLastBlock().data.id === this.lastUpdatedBlockId) {
            return;
        }

        this.updating = true;

        const timestamp =
            (new Date(Utils.formatTimestamp(this.getLastBlock().data.timestamp).unix * 1000).setUTCHours(0, 0, 0, 0) -
                new Date(Managers.configManager.getMilestone(1).epoch).getTime()) /
            1000;

        try {
            const reliabilityStatistics: Record<
                string,
                Record<string, number>
            > = await this.blockProductionFailureRepository.getReliability(
                timestamp - (this.configuration.get("blockProductionFailuresLookback") as number),
            );

            for (const [username, { failures, reliability }] of Object.entries(reliabilityStatistics)) {
                const blockProducerWallet = this.walletRepository.findByUsername(username);
                let oldReliability: number | undefined = undefined;
                if (blockProducerWallet.hasAttribute("blockProducer.reliability")) {
                    oldReliability = blockProducerWallet.getAttribute("blockProducer.reliability");
                }

                let newReliability: number | undefined = undefined;
                if (reliability !== undefined) {
                    newReliability = reliability;
                } else {
                    newReliability = undefined;
                }

                if (!initialStart && newReliability !== oldReliability) {
                    this.events.dispatch(Enums.BlockProducerEvent.ReliabilityChanged, {
                        username,
                        old: oldReliability,
                        new: newReliability,
                    });
                }

                if (newReliability !== undefined) {
                    const newFailures: number = failures ?? 0;
                    const updateFailures =
                        !blockProducerWallet.hasAttribute("blockProducer.failures") ||
                        blockProducerWallet.getAttribute("blockProducer.failures") !== newFailures;
                    const updateReliability =
                        !blockProducerWallet.hasAttribute("blockProducer.reliability") ||
                        blockProducerWallet.getAttribute("blockProducer.reliability") !== newReliability;

                    if (updateFailures) {
                        blockProducerWallet.setAttribute("blockProducer.failures", failures ?? 0);
                    }
                    if (updateReliability) {
                        blockProducerWallet.setAttribute("blockProducer.reliability", newReliability);
                    }
                } else {
                    if (blockProducerWallet.hasAttribute("blockProducer.failures")) {
                        blockProducerWallet.forgetAttribute("blockProducer.failures");
                    }
                    if (blockProducerWallet.hasAttribute("blockProducer.reliability")) {
                        blockProducerWallet.forgetAttribute("blockProducer.reliability");
                    }
                }
            }

            this.lastUpdatedBlockId = this.getLastBlock().data.id;
        } catch {
            //
        }

        this.updating = false;
    }
}

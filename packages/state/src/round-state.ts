import { Blocks, Crypto, Interfaces, Managers, Utils } from "@solar-network/crypto";
import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Enums, Services, Utils as AppUtils } from "@solar-network/kernel";
import assert from "assert";

@Container.injectable()
export class RoundState implements Contracts.State.RoundState {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.DposState)
    @Container.tagged("state", "blockchain")
    private readonly dposState!: Contracts.State.DposState;

    @Container.inject(Container.Identifiers.DposPreviousRoundStateProvider)
    private readonly getDposPreviousRoundState!: Contracts.State.DposPreviousRoundStateProvider;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "state")
    private readonly logger!: Contracts.Kernel.Logger;

    private blocksInCurrentRound: Interfaces.IBlock[] = [];
    private activeBlockProducers: Contracts.State.Wallet[] = [];

    private blockProductionFailuresToSave: { timestamp: number; height: number; username: string }[] = [];
    private roundsToSave: Record<
        number,
        { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]
    > = {};

    public async applyBlock(block: Interfaces.IBlock): Promise<void> {
        this.blocksInCurrentRound.push(block);

        await this.applyRound(block.data.height);
    }

    public getBlockProductionFailuresToSave(): { timestamp: number; height: number; username: string }[] {
        return this.blockProductionFailuresToSave;
    }

    public getRoundsToSave(): Record<
        number,
        { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]
    > {
        return this.roundsToSave;
    }

    public async revertBlock(block: Interfaces.IBlock): Promise<void> {
        if (!this.blocksInCurrentRound.length) {
            this.blocksInCurrentRound = await this.getBlocksForRound();
        }

        assert(
            this.blocksInCurrentRound[this.blocksInCurrentRound.length - 1]!.data.id === block.data.id,
            `Last block in blocksInCurrentRound doesn't match block with id ${block.data.id}`,
        );

        await this.revertRound(block.data.height);
        this.blocksInCurrentRound.pop();
    }

    // TODO: Check if can restore from state
    public async restore(): Promise<void> {
        const block = this.stateStore.getLastBlock();
        const roundInfo = this.getRound(block.data.height);

        this.blocksInCurrentRound = await this.getBlocksForRound();
        await this.calcPreviousActiveBlockProducers(roundInfo, this.blocksInCurrentRound);
        await this.setActiveBlockProducersOfRound(roundInfo);

        await this.applyRound(block.data.height);
    }

    public async getActiveBlockProducers(
        roundInfo?: Contracts.Shared.RoundInfo,
        blockProducers?: Contracts.State.Wallet[],
    ): Promise<Contracts.State.Wallet[]> {
        if (!roundInfo) {
            roundInfo = this.getRound();
        }

        if (
            this.activeBlockProducers.length &&
            this.activeBlockProducers[0].getAttribute<number>("blockProducer.round") === roundInfo.round
        ) {
            return this.activeBlockProducers;
        }

        if (!blockProducers) {
            blockProducers = (await this.databaseService.getRound(roundInfo.round)).map(({ balance, publicKey }) => {
                const blockProducer: Contracts.State.Wallet = this.walletRepository.findByPublicKey(publicKey).clone();
                blockProducer.setAttribute("blockProducer.round", roundInfo!.round);
                blockProducer.setAttribute("blockProducer.voteBalance", Utils.BigNumber.make(balance));

                return blockProducer;
            });
        }

        return this.shuffleBlockProducers(roundInfo, blockProducers);
    }

    public async detectBlockProductionFailures(block: Interfaces.IBlock): Promise<void> {
        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

        if (lastBlock.data.height === 1) {
            return;
        }

        const blockTimeLookup = await AppUtils.blockProductionInfoCalculator.getBlockTimeLookup(
            this.app,
            lastBlock.data.height,
        );

        const lastSlot: number = Crypto.Slots.getSlotNumber(blockTimeLookup, lastBlock.data.timestamp);
        const currentSlot: number = Crypto.Slots.getSlotNumber(blockTimeLookup, block.data.timestamp);

        const { blockTime } = Managers.configManager.getMilestone(lastBlock.data.height);
        const { height } = block.data;
        const slotTime = Crypto.Slots.getSlotTime(
            blockTimeLookup,
            Crypto.Slots.getSlotNumber(blockTimeLookup, lastBlock.data.timestamp),
        );

        const slotsWithoutBlocks: number = currentSlot - lastSlot - 1;

        for (let i = 0; i < slotsWithoutBlocks; i++) {
            const slotWithoutBlock: number = lastSlot + i + 1;
            const blockProducer: Contracts.State.Wallet =
                this.activeBlockProducers[slotWithoutBlock % this.activeBlockProducers.length];

            const timestamp: number = slotTime + blockTime * (i + 1);
            const username: string = blockProducer.getAttribute("username");

            if (i < this.activeBlockProducers.length) {
                this.logger.debug(`${username} just failed to produce a block`, "😔");
                this.events.dispatch(Enums.BlockProducerEvent.Failed, {
                    height,
                    timestamp,
                    username,
                });
            }

            this.blockProductionFailuresToSave.push({ timestamp, height, username });
        }
    }

    public async getRewardForBlockInRound(
        height: number,
        wallet: Contracts.State.Wallet,
    ): Promise<{ alreadyProducedBlock: boolean; reward: Utils.BigNumber }> {
        const { dynamicReward } = Managers.configManager.getMilestone(height);
        let alreadyProducedBlock: boolean = false;
        let reward: Utils.BigNumber | undefined = undefined;
        if (dynamicReward && dynamicReward.enabled) {
            alreadyProducedBlock = this.blocksInCurrentRound.some(
                (blockGenerator) => blockGenerator.data.username === wallet.getAttribute("username"),
            );
            if (alreadyProducedBlock) {
                reward = Utils.BigNumber.make(dynamicReward.secondaryReward);
            }
        }

        if (reward === undefined) {
            reward = Utils.calculateReward(height, wallet.getAttribute("blockProducer.rank"));
        }

        return { alreadyProducedBlock, reward };
    }

    private async applyRound(height: number): Promise<void> {
        if (height === 1 || AppUtils.roundCalculator.isNewRound(height + 1)) {
            const roundInfo = this.getRound(height + 1);

            this.detectFailedBlockProducersInRound(roundInfo.round - 1);
            this.logger.info(`Starting round ${roundInfo.round.toLocaleString()}`, "🕊️");

            this.dposState.buildBlockProducerRanking(roundInfo);
            this.dposState.setBlockProducersRound(roundInfo);

            const roundBlockProducers = this.dposState.getRoundBlockProducers();

            await this.setActiveBlockProducersOfRound(roundInfo, roundBlockProducers.slice());

            this.roundsToSave[height] = roundBlockProducers.map((blockProducer: Contracts.State.Wallet) => ({
                balance: blockProducer.getAttribute("blockProducer.voteBalance"),
                roundHeight: roundInfo.roundHeight,
                publicKey: blockProducer.getPublicKey("primary")!,
                round: blockProducer.getAttribute("blockProducer.round"),
                username: blockProducer.getAttribute("username"),
            }));

            this.blocksInCurrentRound = [];

            this.events.dispatch(Enums.RoundEvent.Applied);
        }
    }

    private async revertRound(height: number): Promise<void> {
        const roundInfo = this.getRound(height);
        const { round, nextRound } = roundInfo;

        if (nextRound === round + 1) {
            this.logger.info(`Back to previous round: ${round.toLocaleString()}`, "⬅️");

            this.dposState.buildBlockProducerRanking(roundInfo);

            await this.setActiveBlockProducersOfRound(
                roundInfo,
                await this.calcPreviousActiveBlockProducers(roundInfo, this.blocksInCurrentRound),
            );
        }
    }

    private detectFailedBlockProducersInRound(round: number): void {
        for (const blockProducer of this.activeBlockProducers) {
            const username = blockProducer.getAttribute("username");
            const isBlockProduced = this.blocksInCurrentRound.some(
                (blockGenerator) => blockGenerator.data.username === username,
            );

            if (!isBlockProduced) {
                this.logger.debug(
                    `${blockProducer.getAttribute("username")} failed to produce a block in this round`,
                    "😰",
                );

                this.events.dispatch(Enums.RoundEvent.Failed, {
                    username,
                    round,
                });
            }
        }
    }

    private async getBlocksForRound(): Promise<Interfaces.IBlock[]> {
        const lastBlock = this.stateStore.getLastBlock();
        const roundInfo = this.getRound(lastBlock.data.height);

        const maxBlocks = lastBlock.data.height - roundInfo.roundHeight + 1;

        let blocks = this.stateStore.getLastBlocksByHeight(
            roundInfo.roundHeight,
            roundInfo.roundHeight + maxBlocks - 1,
        );

        if (blocks.length !== maxBlocks) {
            blocks = [
                ...(await this.databaseService.getBlocks(
                    roundInfo.roundHeight,
                    roundInfo.roundHeight + maxBlocks - blocks.length - 1,
                )),
                ...blocks,
            ];
        }

        assert(blocks.length === maxBlocks);

        return blocks.map(
            (block: Interfaces.IBlockData) =>
                Blocks.BlockFactory.fromData(block, { deserialiseTransactionsUnchecked: true })!,
        );
    }

    private shuffleBlockProducers(
        roundInfo: Contracts.Shared.RoundInfo,
        blockProducers: Contracts.State.Wallet[],
    ): Contracts.State.Wallet[] {
        const seedSource: string = roundInfo.round.toString();
        let currentSeed: Buffer = Crypto.HashAlgorithms.sha256(seedSource);

        blockProducers = blockProducers.map((blockProducer) => blockProducer.clone());
        for (let i = 0, blockProducerCount = blockProducers.length; i < blockProducerCount; i++) {
            for (let x = 0; x < 4 && i < blockProducerCount; i++, x++) {
                const newIndex = currentSeed[x] % blockProducerCount;
                const b = blockProducers[newIndex];
                blockProducers[newIndex] = blockProducers[i];
                blockProducers[i] = b;
            }
            currentSeed = Crypto.HashAlgorithms.sha256(currentSeed);
        }

        return blockProducers;
    }

    private getRound(height?: number): Contracts.Shared.RoundInfo {
        if (!height) {
            height = this.stateStore.getLastBlock().data.height;
        }

        return AppUtils.roundCalculator.calculateRound(height);
    }

    private async setActiveBlockProducersOfRound(
        roundInfo: Contracts.Shared.RoundInfo,
        blockProducers?: Contracts.State.Wallet[],
    ): Promise<void> {
        const result = await this.triggers.call("getActiveBlockProducers", { roundInfo, blockProducers });
        this.activeBlockProducers = (result as Contracts.State.Wallet[]) || [];
    }

    private async calcPreviousActiveBlockProducers(
        roundInfo: Contracts.Shared.RoundInfo,
        blocks: Interfaces.IBlock[],
    ): Promise<Contracts.State.Wallet[]> {
        const prevRoundState = await this.getDposPreviousRoundState(blocks, roundInfo);

        for (const prevRoundBlockProducerWallet of prevRoundState.getActiveBlockProducers()) {
            const username = prevRoundBlockProducerWallet.getAttribute("username");
            const blockProducerWallet = this.walletRepository.findByUsername(username);
            blockProducerWallet.setAttribute(
                "blockProducer.rank",
                prevRoundBlockProducerWallet.getAttribute("blockProducer.rank"),
            );
        }

        return prevRoundState.getRoundBlockProducers().slice();
    }
}

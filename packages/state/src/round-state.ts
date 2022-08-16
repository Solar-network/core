import { Blocks, Crypto, Interfaces, Managers, Utils } from "@solar-network/crypto";
import { DatabaseService, Repositories } from "@solar-network/database";
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

    @Container.inject(Container.Identifiers.DatabaseMissedBlockRepository)
    private readonly missedBlockRepository!: Repositories.MissedBlockRepository;

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
    private readonly logger!: Contracts.Kernel.Logger;

    private blocksInCurrentRound: Interfaces.IBlock[] = [];
    private forgingDelegates: Contracts.State.Wallet[] = [];

    public async applyBlock(block: Interfaces.IBlock): Promise<void> {
        this.blocksInCurrentRound.push(block);

        await this.applyRound(block.data.height);
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
        await this.calcPreviousActiveDelegates(roundInfo, this.blocksInCurrentRound);
        await this.setForgingDelegatesOfRound(roundInfo);

        await this.databaseService.deleteRound(roundInfo.round + 1);

        await this.applyRound(block.data.height);
    }

    public async getActiveDelegates(
        roundInfo?: Contracts.Shared.RoundInfo,
        delegates?: Contracts.State.Wallet[],
    ): Promise<Contracts.State.Wallet[]> {
        if (!roundInfo) {
            roundInfo = this.getRound();
        }

        if (
            this.forgingDelegates.length &&
            this.forgingDelegates[0].getAttribute<number>("delegate.round") === roundInfo.round
        ) {
            return this.forgingDelegates;
        }

        // When called during applyRound we already know the delegates, so we don't have to query the database.
        if (!delegates) {
            delegates = (await this.databaseService.getRound(roundInfo.round)).map(({ balance, publicKey }) => {
                const delegate: Contracts.State.Wallet = this.walletRepository.findByPublicKey(publicKey).clone();
                delegate.setAttribute("delegate.round", roundInfo!.round);
                delegate.setAttribute("delegate.voteBalance", Utils.BigNumber.make(balance));

                return delegate;
            });
        }

        return this.shuffleDelegates(roundInfo, delegates);
    }

    public async detectMissedBlocks(block: Interfaces.IBlock): Promise<void> {
        const lastBlock: Interfaces.IBlock = this.stateStore.getLastBlock();

        if (lastBlock.data.height === 1) {
            return;
        }

        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(
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

        const missedSlots: number = currentSlot - lastSlot - 1;
        const missedBlocks: { timestamp: number; height: number; username: string }[] = [];

        for (let i = 0; i < missedSlots; i++) {
            const missedSlot: number = lastSlot + i + 1;
            const delegate: Contracts.State.Wallet = this.forgingDelegates[missedSlot % this.forgingDelegates.length];

            const timestamp: number = slotTime + blockTime * (i + 1);
            const username: string = delegate.getAttribute("delegate.username");

            if (i < this.forgingDelegates.length) {
                this.logger.debug(`Delegate ${username} just missed a block :pensive:`);
                this.events.dispatch(Enums.ForgerEvent.Missing, {
                    delegate,
                });
            }

            missedBlocks.push({ timestamp, height, username });
        }
        this.missedBlockRepository.addMissedBlocks(missedBlocks);
    }

    public async getRewardForBlockInRound(
        height: number,
        wallet: Contracts.State.Wallet,
    ): Promise<{ alreadyForged: boolean; reward: Utils.BigNumber }> {
        const { dynamicReward } = Managers.configManager.getMilestone(height);
        let alreadyForged: boolean = false;
        let reward: Utils.BigNumber | undefined = undefined;
        if (dynamicReward && dynamicReward.enabled) {
            alreadyForged = this.blocksInCurrentRound.some(
                (blockGenerator) => blockGenerator.data.username === wallet.getAttribute("delegate.username"),
            );
            if (alreadyForged) {
                reward = Utils.BigNumber.make(dynamicReward.secondaryReward);
            }
        }

        if (reward === undefined) {
            reward = Utils.calculateReward(height, wallet.getAttribute("delegate.rank"));
        }

        return { alreadyForged, reward };
    }

    private async applyRound(height: number): Promise<void> {
        if (height === 1 || AppUtils.roundCalculator.isNewRound(height + 1)) {
            const roundInfo = this.getRound(height + 1);

            this.logger.info(`Starting Round ${roundInfo.round.toLocaleString()} :dove_of_peace:`);

            this.detectMissedRound();

            this.dposState.buildDelegateRanking();
            this.dposState.setDelegatesRound(roundInfo);

            await this.setForgingDelegatesOfRound(roundInfo, this.dposState.getRoundDelegates().slice());

            await this.databaseService.saveRound(this.dposState.getRoundDelegates());

            this.blocksInCurrentRound = [];

            this.events.dispatch(Enums.RoundEvent.Applied);
        }
    }

    private async revertRound(height: number): Promise<void> {
        const roundInfo = this.getRound(height);
        const { round, nextRound } = roundInfo;

        if (nextRound === round + 1) {
            this.logger.info(`Back to previous round: ${round.toLocaleString()} :back:`);

            await this.setForgingDelegatesOfRound(
                roundInfo,
                await this.calcPreviousActiveDelegates(roundInfo, this.blocksInCurrentRound),
            );

            await this.databaseService.deleteRound(nextRound);
        }
    }

    private detectMissedRound(): void {
        for (const delegate of this.forgingDelegates) {
            const isBlockProduced = this.blocksInCurrentRound.some(
                (blockGenerator) => blockGenerator.data.username === delegate.getAttribute("delegate.username"),
            );

            if (!isBlockProduced) {
                this.logger.debug(
                    `Delegate ${delegate.getAttribute("delegate.username")} just missed a round :cold_sweat:`,
                );

                this.events.dispatch(Enums.RoundEvent.Missed, {
                    delegate,
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

        return blocks.map((block: Interfaces.IBlockData) => {
            return Blocks.BlockFactory.fromData(block, { deserialiseTransactionsUnchecked: true })!;
        });
    }

    private shuffleDelegates(
        roundInfo: Contracts.Shared.RoundInfo,
        delegates: Contracts.State.Wallet[],
    ): Contracts.State.Wallet[] {
        const seedSource: string = roundInfo.round.toString();
        let currentSeed: Buffer = Crypto.HashAlgorithms.sha256(seedSource);

        delegates = delegates.map((delegate) => delegate.clone());
        for (let i = 0, delCount = delegates.length; i < delCount; i++) {
            for (let x = 0; x < 4 && i < delCount; i++, x++) {
                const newIndex = currentSeed[x] % delCount;
                const b = delegates[newIndex];
                delegates[newIndex] = delegates[i];
                delegates[i] = b;
            }
            currentSeed = Crypto.HashAlgorithms.sha256(currentSeed);
        }

        return delegates;
    }

    private getRound(height?: number): Contracts.Shared.RoundInfo {
        if (!height) {
            height = this.stateStore.getLastBlock().data.height;
        }

        return AppUtils.roundCalculator.calculateRound(height);
    }

    private async setForgingDelegatesOfRound(
        roundInfo: Contracts.Shared.RoundInfo,
        delegates?: Contracts.State.Wallet[],
    ): Promise<void> {
        // ! it's this.getActiveDelegates(roundInfo, delegates);
        // ! only last part of that function which reshuffles delegates is used
        const result = await this.triggers.call("getActiveDelegates", { roundInfo, delegates });
        this.forgingDelegates = (result as Contracts.State.Wallet[]) || [];
    }

    private async calcPreviousActiveDelegates(
        roundInfo: Contracts.Shared.RoundInfo,
        blocks: Interfaces.IBlock[],
    ): Promise<Contracts.State.Wallet[]> {
        const prevRoundState = await this.getDposPreviousRoundState(blocks, roundInfo);

        // TODO: Move to Dpos
        for (const prevRoundDelegateWallet of prevRoundState.getActiveDelegates()) {
            // ! name suggest that this is pure function
            // ! when in fact it is manipulating current wallet repository setting delegate ranks
            const username = prevRoundDelegateWallet.getAttribute("delegate.username");
            const delegateWallet = this.walletRepository.findByUsername(username);
            delegateWallet.setAttribute("delegate.rank", prevRoundDelegateWallet.getAttribute("delegate.rank"));
        }

        // ! return readonly array instead of taking slice
        return prevRoundState.getRoundDelegates().slice();
    }
}

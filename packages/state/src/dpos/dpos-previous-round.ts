import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class DposPreviousRoundState implements Contracts.State.DposPreviousRoundState {
    @Container.inject(Container.Identifiers.BlockState)
    @Container.tagged("state", "clone")
    private readonly blockState!: Contracts.State.BlockState;

    @Container.inject(Container.Identifiers.DposState)
    @Container.tagged("state", "clone")
    private readonly dposState!: Contracts.State.DposState;

    public async revert(blocks: Interfaces.IBlock[], roundInfo: Contracts.Shared.RoundInfo): Promise<void> {
        for (const block of blocks.slice().reverse()) {
            if (block.data.height === 1) {
                break;
            }
            await this.blockState.revertBlock(block);
        }

        this.dposState.buildBlockProducerRanking(roundInfo);

        this.dposState.setBlockProducersRound(roundInfo);
    }

    public getAllBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.dposState.getAllBlockProducers();
    }

    public getActiveBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.dposState.getActiveBlockProducers();
    }

    public getRoundBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.dposState.getRoundBlockProducers();
    }
}

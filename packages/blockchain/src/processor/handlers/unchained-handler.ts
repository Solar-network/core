import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Services, Utils } from "@solar-network/kernel";

import { BlockProcessorResult } from "../block-processor";
import { BlockHandler } from "../contracts";

enum UnchainedBlockStatus {
    NotReadyToAcceptNewHeight,
    AlreadyInBlockchain,
    EqualToLastBlock,
    GeneratorMismatch,
    MultipleBlocks,
    InvalidTimestamp,
}

@Container.injectable()
export class UnchainedHandler implements BlockHandler {
    @Container.inject(Container.Identifiers.BlockchainService)
    protected readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    private isValidGenerator: boolean = false;

    // todo: remove the need for this method
    public initialise(isValidGenerator: boolean): this {
        this.isValidGenerator = isValidGenerator;

        return this;
    }

    public async execute(block: Interfaces.IBlock): Promise<BlockProcessorResult> {
        this.blockchain.resetLastDownloadedBlock();

        this.blockchain.clearQueue();

        const status: UnchainedBlockStatus = this.checkUnchainedBlock(block);

        switch (status) {
            case UnchainedBlockStatus.MultipleBlocks: {
                const roundInfo: Contracts.Shared.RoundInfo = Utils.roundCalculator.calculateRound(block.data.height);

                const blockProducers: Contracts.State.Wallet[] = (await this.triggers.call("getActiveBlockProducers", {
                    roundInfo,
                })) as Contracts.State.Wallet[];

                if (
                    blockProducers.some(
                        (blockProducer) => blockProducer.getAttribute("username") === block.data.username,
                    )
                ) {
                    return BlockProcessorResult.Rollback;
                }

                return BlockProcessorResult.Rejected;
            }

            case UnchainedBlockStatus.NotReadyToAcceptNewHeight:
            case UnchainedBlockStatus.GeneratorMismatch:
            case UnchainedBlockStatus.InvalidTimestamp: {
                return BlockProcessorResult.Rejected;
            }

            default: {
                return BlockProcessorResult.DiscardedButCanBeBroadcasted;
            }
        }
    }

    private checkUnchainedBlock(block: Interfaces.IBlock): UnchainedBlockStatus {
        const lastBlock: Interfaces.IBlock = this.blockchain.getLastBlock();

        if (block.data.height > lastBlock.data.height + 1) {
            return UnchainedBlockStatus.NotReadyToAcceptNewHeight;
        } else if (block.data.height < lastBlock.data.height) {
            return UnchainedBlockStatus.AlreadyInBlockchain;
        } else if (block.data.height === lastBlock.data.height && block.data.id === lastBlock.data.id) {
            return UnchainedBlockStatus.EqualToLastBlock;
        } else if (block.data.timestamp < lastBlock.data.timestamp) {
            return UnchainedBlockStatus.InvalidTimestamp;
        } else {
            if (this.isValidGenerator) {
                return UnchainedBlockStatus.MultipleBlocks;
            }
            return UnchainedBlockStatus.GeneratorMismatch;
        }
    }
}

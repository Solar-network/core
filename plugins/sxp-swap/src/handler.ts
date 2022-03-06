import { BlockProcessorResult } from "@solar-network/core-blockchain/dist/processor";
import { BlockHandler } from "@solar-network/core-blockchain/dist/processor/contracts";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Interfaces } from "@solar-network/crypto";

@Container.injectable()
export class DuplicateSwapTransactionsHandler implements BlockHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    protected readonly blockchain!: Contracts.Blockchain.Blockchain;

    public async execute(block?: Interfaces.IBlock): Promise<BlockProcessorResult> {
        this.blockchain.resetLastDownloadedBlock();

        return BlockProcessorResult.Rejected;
    }
}

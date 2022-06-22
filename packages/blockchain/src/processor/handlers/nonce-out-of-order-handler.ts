import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { BlockProcessorResult } from "../block-processor";
import { BlockHandler } from "../contracts";

@Container.injectable()
export class NonceOutOfOrderHandler implements BlockHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    protected readonly blockchain!: Contracts.Blockchain.Blockchain;

    public async execute(block?: Interfaces.IBlock): Promise<BlockProcessorResult> {
        this.blockchain.resetLastDownloadedBlock();

        return BlockProcessorResult.Rejected;
    }
}

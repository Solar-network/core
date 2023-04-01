import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils } from "@solar-network/kernel";
import { DatabaseInterceptor } from "@solar-network/state";

import { BlockProcessorResult } from "../block-processor";
import { BlockHandler } from "../contracts";
import { AcceptBlockHandler } from "./accept-block-handler";

@Container.injectable()
export class ExceptionHandler implements BlockHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    protected readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "blockchain")
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.DatabaseInterceptor)
    private readonly databaseInterceptor!: DatabaseInterceptor;

    public async execute(block: Interfaces.IBlock): Promise<BlockProcessorResult> {
        Utils.assert.defined<string>(block.data.id);

        const id: string = block.data.id;

        const producedBlock: Interfaces.IBlock | undefined = await this.databaseInterceptor.getBlock(id);

        if (producedBlock || block.data.height !== this.blockchain.getLastBlock().data.height + 1) {
            this.blockchain.resetLastDownloadedBlock();

            return BlockProcessorResult.Rejected;
        }

        this.logger.warning(`Block ${block.data.height.toLocaleString()} (${id}) forcibly accepted`, "🪲");

        return this.app.resolve<AcceptBlockHandler>(AcceptBlockHandler).execute(block);
    }
}

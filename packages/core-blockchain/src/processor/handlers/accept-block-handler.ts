import { Container, Contracts } from "@solar-network/core-kernel";
import { DatabaseInteraction } from "@solar-network/core-state";
import { Interfaces } from "@solar-network/crypto";

import { BlockProcessorResult } from "../block-processor";
import { BlockHandler } from "../contracts";
import { RevertBlockHandler } from "./revert-block-handler";

@Container.injectable()
export class AcceptBlockHandler implements BlockHandler {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    protected readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly state!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.DatabaseInteraction)
    private readonly databaseInteraction!: DatabaseInteraction;

    @Container.inject(Container.Identifiers.TransactionPoolService)
    private readonly transactionPool!: Contracts.TransactionPool.Service;

    public async execute(block: Interfaces.IBlock): Promise<BlockProcessorResult> {
        const transactionProcessing = { index: undefined };
        try {
            await this.databaseInteraction.applyBlock(block, transactionProcessing);

            // Check if we recovered from a fork
            const forkedBlock = this.state.getForkedBlock();
            if (forkedBlock && forkedBlock.data.height === block.data.height) {
                this.logger.info("Successfully recovered from fork :star2:");
                this.state.clearForkedBlock();
            }

            for (const transaction of block.transactions) {
                await this.transactionPool.removeForgedTransaction(transaction);
            }

            // Reset wake-up timer after chaining a block, since there's no need to
            // wake up at all if blocks arrive periodically. Only wake up when there are
            // no new blocks.
            /* istanbul ignore else */
            if (this.state.isStarted()) {
                this.blockchain.resetWakeUp();
            }

            // Ensure the lastDownloadedBlock is never behind the last accepted block.
            const lastDownloadedBock = this.state.getLastDownloadedBlock();
            if (lastDownloadedBock && lastDownloadedBock.height < block.data.height) {
                this.state.setLastDownloadedBlock(block.data);
            }

            return BlockProcessorResult.Accepted;
        } catch (error) {
            this.logger.warning(`Refused new block with id ${block.data.id} :warning: :warning: :warning:`);
            if (transactionProcessing.index !== undefined) {
                this.logger.warning(`Block contains a bad transaction: ${error.message} :no_entry:`);
                this.logger.warning(
                    `Bad transaction data: ${JSON.stringify(block.transactions[transactionProcessing.index].data)}`,
                );
            } else {
                this.logger.warning(`Block is bad: ${error.message} :no_entry:`);
                this.logger.warning(`Bad block data: ${JSON.stringify(block.data)}`);
            }
            this.blockchain.resetLastDownloadedBlock();

            // Revert block if accepted
            if (this.state.getLastBlock().data.height === block.data.height) {
                const revertResult = await this.app.resolve<RevertBlockHandler>(RevertBlockHandler).execute(block);

                if (revertResult === BlockProcessorResult.Corrupted) {
                    return revertResult;
                }
            }

            return BlockProcessorResult.Rejected;
        }
    }
}

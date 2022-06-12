import { Container, Contracts } from "@solar-network/core-kernel";
import { Interfaces, Managers } from "@solar-network/crypto";

import { TransactionHasExpiredError } from "./errors";

@Container.injectable()
export class Collator implements Contracts.TransactionPool.Collator {
    @Container.inject(Container.Identifiers.TransactionValidatorFactory)
    private readonly createTransactionValidator!: Contracts.State.TransactionValidatorFactory;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.TransactionPoolService)
    private readonly pool!: Contracts.TransactionPool.Service;

    @Container.inject(Container.Identifiers.TransactionPoolExpirationService)
    private readonly expirationService!: Contracts.TransactionPool.ExpirationService;

    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public async getBlockCandidateTransactions(validate: boolean): Promise<Interfaces.ITransaction[]> {
        const height: number = this.blockchain.getLastBlock().data.height;
        const milestone = Managers.configManager.getMilestone(height);
        const blockHeaderSize =
            4 + // version
            4 + // timestamp
            4 + // height
            32 + // previousBlockId
            4 + // numberOfTransactions
            8 + // totalAmount
            8 + // totalFee
            8 + // reward
            4 + // payloadLength
            32 + // payloadHash
            33; // generatorPublicKey

        let bytesLeft: number = milestone.block.maxPayload - blockHeaderSize;

        const candidateTransactions: Interfaces.ITransaction[] = [];
        const validator: Contracts.State.TransactionValidator = this.createTransactionValidator();
        const failedTransactions: Interfaces.ITransaction[] = [];

        for (const transaction of this.poolQuery.getFromHighestPriority()) {
            if (candidateTransactions.length === milestone.block.maxTransactions) {
                break;
            }

            if (failedTransactions.some((t) => t.data.senderPublicKey === transaction.data.senderPublicKey)) {
                continue;
            }

            try {
                if (this.expirationService.isExpired(transaction)) {
                    const expirationHeight: number = this.expirationService.getExpirationHeight(transaction);
                    throw new TransactionHasExpiredError(transaction, expirationHeight);
                }

                if (bytesLeft - 4 - transaction.serialised.length < 0) {
                    break;
                }

                if (validate) {
                    await validator.validate(transaction);
                }

                candidateTransactions.push(transaction);

                bytesLeft -= 4;
                bytesLeft -= transaction.serialised.length;
            } catch (error) {
                this.logger.warning(`${transaction} failed to collate: ${error.message} :warning:`);
                failedTransactions.push(transaction);
            }
        }

        (async () => {
            for (const failedTransaction of failedTransactions) {
                await this.pool.removeTransaction(failedTransaction);
            }
        })();

        return candidateTransactions;
    }
}

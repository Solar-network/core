import { Interfaces, Managers } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { TransactionHasExpiredError } from "./errors";

@Container.injectable()
export class Collator implements Contracts.Pool.Collator {
    @Container.inject(Container.Identifiers.TransactionValidatorFactory)
    private readonly createTransactionValidator!: Contracts.State.TransactionValidatorFactory;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.PoolService)
    private readonly pool!: Contracts.Pool.Service;

    @Container.inject(Container.Identifiers.PoolExpirationService)
    private readonly expirationService!: Contracts.Pool.ExpirationService;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public async getBlockCandidateTransactions(
        validate: boolean,
        exclude: string[],
    ): Promise<Interfaces.ITransaction[]> {
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

        const transactions: Interfaces.ITransaction[] = Array.from(this.poolQuery.getFromHighestPriority()).filter(
            (t) => !exclude.includes(t.id!),
        );

        for (const transaction of transactions) {
            if (candidateTransactions.length === milestone.block.maxTransactions) {
                break;
            }

            if (failedTransactions.some((t) => t.data.senderId === transaction.data.senderId)) {
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

                let candidateTransaction: Interfaces.ITransaction;
                if (validate) {
                    candidateTransaction = await validator.validate(transaction);
                } else {
                    candidateTransaction = transaction;
                }
                candidateTransactions.push(candidateTransaction);

                bytesLeft -= 4;
                bytesLeft -= candidateTransaction.serialised.length;
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

import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Interfaces } from "@solar-network/crypto";

import { Controller } from "./controller";

export class TransactionsController extends Controller {
    @Container.inject(Container.Identifiers.TransactionPoolCollator)
    private readonly collator!: Contracts.TransactionPool.Collator;

    @Container.inject(Container.Identifiers.TransactionPoolProcessor)
    private readonly processor!: Contracts.TransactionPool.Processor;

    @Container.inject(Container.Identifiers.TransactionPoolService)
    private readonly transactionPool!: Contracts.TransactionPool.Service;

    public async getUnconfirmedTransactions(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.P2P.UnconfirmedTransactions> {
        const transactions: Interfaces.ITransaction[] = (request.payload as any).countOnly
            ? []
            : await this.collator.getBlockCandidateTransactions();

        return {
            poolSize: this.transactionPool.getPoolSize(),
            transactions: transactions.map((t) => t.serialised),
        };
    }

    public async postTransactions(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<string[]> {
        const result = await this.processor.process((request.payload as any).transactions as Buffer[]);
        return result.accept;
    }
}

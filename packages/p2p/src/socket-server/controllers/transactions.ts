import Hapi from "@hapi/hapi";
import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Providers, Utils } from "@solar-network/kernel";

import { Controller } from "./controller";

export class TransactionsController extends Controller {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/p2p")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PoolCollator)
    private readonly collator!: Contracts.Pool.Collator;

    @Container.inject(Container.Identifiers.PoolProcessor)
    private readonly processor!: Contracts.Pool.Processor;

    @Container.inject(Container.Identifiers.PoolService)
    private readonly pool!: Contracts.Pool.Service;

    public async getUnconfirmedTransactions(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.P2P.UnconfirmedTransactions> {
        const fromForger: boolean = !Utils.isWhitelisted(
            this.configuration.getOptional<string[]>("remoteAccess", []),
            request.info.remoteAddress,
        );
        const transactions: Interfaces.ITransaction[] = (request.payload as any).countOnly
            ? []
            : await this.collator.getBlockCandidateTransactions(fromForger);

        return {
            poolSize: this.pool.getPoolSize(),
            transactions: transactions.map((t) => t.serialised),
        };
    }

    public async postTransactions(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<string[]> {
        const result = await this.processor.process((request.payload as any).transactions as Buffer[]);
        return result.accept;
    }
}

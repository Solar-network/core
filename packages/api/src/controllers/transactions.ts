import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import { TransactionResource, TransactionWithBlockResource } from "../resources";
import { Controller } from "./controller";

export interface StoreRequest extends Hapi.Request {
    payload: {
        transactions: Interfaces.ITransactionData[];
    };
}

@Container.injectable()
export class TransactionsController extends Controller {
    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "null")
    private readonly nullHandlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.PoolProcessor)
    private readonly processor!: Contracts.Pool.Processor;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.Search.ResultsPage<object>> {
        const criteria: Contracts.Shared.TransactionCriteria = request.query;
        const sorting: Contracts.Search.Sorting = this.getListingOrder(request);
        const pagination: Contracts.Search.Pagination = this.getListingPage(request);

        if (request.query.transform) {
            const transactionListResult = await this.transactionHistoryService.listByCriteriaJoinBlock(
                criteria,
                sorting,
                pagination,
            );

            return this.toPagination(transactionListResult, TransactionWithBlockResource, true);
        } else {
            const transactionListResult = await this.transactionHistoryService.listByCriteria(
                criteria,
                sorting,
                pagination,
            );
            return this.toPagination(transactionListResult, TransactionResource, false);
        }
    }

    public async store(request: StoreRequest, h: Hapi.ResponseToolkit) {
        const result = await this.processor.process(request.payload.transactions);
        return {
            data: {
                accept: result.accept,
                broadcast: result.broadcast,
                excess: result.excess,
                invalid: result.invalid,
            },
            errors: result.errors,
        };
    }

    public async show(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const transaction = await this.transactionHistoryService.findOneByCriteria({ id: request.params.id });
        if (!transaction) {
            return Boom.notFound("Transaction not found");
        }

        if (request.query.transform) {
            const blockData = await this.blockHistoryService.findOneByCriteria({ height: transaction.blockHeight! });

            return this.respondWithResource(
                { data: transaction, block: blockData },
                TransactionWithBlockResource,
                true,
            );
        } else {
            return this.respondWithResource(transaction, TransactionResource, false);
        }
    }

    public async unconfirmed(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object>> {
        const pagination: Contracts.Search.Pagination = super.getListingPage(request);
        const all: Interfaces.ITransaction[] = Array.from(this.poolQuery.getFromHighestPriority());
        const transactions: Interfaces.ITransaction[] = all.slice(
            pagination.offset,
            pagination.offset + pagination.limit,
        );
        const results = transactions.map((t) => {
            delete t.data.burnedFee;
            return t.data;
        });
        const resultsPage = {
            results,
            totalCount: all.length,
        };

        return super.toPagination(resultsPage, TransactionResource, !!request.query.transform);
    }

    public async showUnconfirmed(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const transactionQuery: Contracts.Pool.QueryIterable = this.poolQuery
            .getFromHighestPriority()
            .whereId(request.params.id);

        if (!transactionQuery.has()) {
            return Boom.notFound("Transaction not found");
        }

        const transaction: Interfaces.ITransaction = transactionQuery.first();
        delete transaction.data.burnedFee;

        return super.respondWithResource(transaction.data, TransactionResource, !!request.query.transform);
    }

    public async types(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<{ data: string[] }> {
        const activatedTransactionHandlers = await this.nullHandlerRegistry.getActivatedHandlers();
        const types: string[] = [];

        for (const handler of activatedTransactionHandlers) {
            const constructor = handler.getConstructor();
            const key: string | undefined = constructor.key;

            AppUtils.assert.defined<string>(key);

            types.push(key);
        }

        return { data: types };
    }

    public async schemas(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<{ data: Record<string, Record<string, any>> }> {
        const activatedTransactionHandlers = await this.nullHandlerRegistry.getActivatedHandlers();
        const schemasByType: Record<string, Record<string, any>> = {};

        for (const handler of activatedTransactionHandlers) {
            const constructor = handler.getConstructor();

            const key: string = constructor.key;

            AppUtils.assert.defined<string>(key);

            schemasByType[key] = constructor.getSchema().properties;
        }

        return { data: schemasByType };
    }
}

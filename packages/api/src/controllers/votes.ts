import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";

import { TransactionResource } from "../resources";
import { Controller } from "./controller";

@Container.injectable()
export class VotesController extends Controller {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.Search.ResultsPage<object>> {
        const criteria = {
            ...request.query,
            type: "vote",
        };

        const transactionListResult = await this.transactionHistoryService.listByCriteria(
            criteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            !!request.query.count,
        );

        return this.toPagination(transactionListResult, TransactionResource, request.query.transform);
    }

    public async show(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const transaction = await this.transactionHistoryService.findOneByCriteria({
            type: "vote",
            id: request.params.id,
        });

        if (transaction && transaction.type === "vote") {
            return this.respondWithResource(transaction, TransactionResource, request.query.transform);
        }

        return Boom.notFound("Vote not found");
    }
}

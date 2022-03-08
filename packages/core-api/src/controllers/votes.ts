import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Enums } from "@solar-network/crypto";

import { TransactionResource } from "../resources";
import { Controller } from "./controller";

@Container.injectable()
export class VotesController extends Controller {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.Search.ResultsPage<object>> {
        const criteria = {
            ...request.query,
            typeGroup: Enums.TransactionTypeGroup.Core,
            type: Enums.TransactionType.Core.Vote,
        };

        const transactionListResult = await this.transactionHistoryService.listByCriteria(
            criteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            this.getListingOptions(),
        );

        return this.toPagination(transactionListResult, TransactionResource, request.query.transform);
    }

    public async show(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const transaction = await this.transactionHistoryService.findOneByCriteria({
            typeGroup: Enums.TransactionTypeGroup.Core,
            type: Enums.TransactionType.Core.Vote,
            id: request.params.id,
        });

        if (
            !transaction ||
            transaction.type !== Enums.TransactionType.Core.Vote ||
            transaction.typeGroup !== Enums.TransactionTypeGroup.Core
        ) {
            return Boom.notFound("Vote not found");
        }

        return this.respondWithResource(transaction, TransactionResource, request.query.transform);
    }
}

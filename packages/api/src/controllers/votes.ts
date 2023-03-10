import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Enums } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { TransactionResource } from "../resources";
import { Controller } from "./controller";

@Container.injectable()
export class VotesController extends Controller {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    @Container.tagged("connection", "api")
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.Search.ResultsPage<object>> {
        const legacyCriteria = {
            ...request.query,
            typeGroup: Enums.TransactionTypeGroup.Core,
            type: Enums.TransactionType.Core.Vote,
        };

        const criteria = {
            ...request.query,
            typeGroup: Enums.TransactionTypeGroup.Solar,
            type: Enums.TransactionType.Solar.Vote,
        };

        const transactionListResult = await this.transactionHistoryService.listByCriteria(
            [legacyCriteria, criteria],
            this.getListingOrder(request),
            this.getListingPage(request),
            this.getListingOptions(),
        );

        return this.toPagination(transactionListResult, TransactionResource, request.query.transform);
    }

    public async show(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const transaction = await this.transactionHistoryService.findOneByCriteria({
            typeGroup: [Enums.TransactionTypeGroup.Core, Enums.TransactionTypeGroup.Solar],
            type: [Enums.TransactionType.Core.Vote, Enums.TransactionType.Solar.Vote],
            id: request.params.id,
        });

        if (
            transaction &&
            ((transaction.type === Enums.TransactionType.Core.Vote &&
                transaction.typeGroup === Enums.TransactionTypeGroup.Core) ||
                (transaction.type === Enums.TransactionType.Solar.Vote &&
                    transaction.typeGroup === Enums.TransactionTypeGroup.Solar))
        ) {
            return this.respondWithResource(transaction, TransactionResource, request.query.transform);
        }

        return Boom.notFound("Vote not found");
    }
}

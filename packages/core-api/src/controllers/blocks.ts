import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Enums } from "@solar-network/crypto";

import { BlockResource, BlockWithTransactionsResource, TransactionResource } from "../resources";
import { Controller } from "./controller";

@Container.injectable()
export class BlocksController extends Controller {
    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object> {
        if (request.query.transform) {
            const blockWithSomeTransactionsListResult = await this.blockHistoryService.listByCriteriaJoinTransactions(
                request.query,
                { typeGroup: Enums.TransactionTypeGroup.Core, type: Enums.TransactionType.Core.MultiPayment },
                this.getListingOrder(request),
                this.getListingPage(request),
                this.getListingOptions(),
            );

            return this.toPagination(blockWithSomeTransactionsListResult, BlockWithTransactionsResource, true);
        } else {
            const blockListResult = await this.blockHistoryService.listByCriteria(
                request.query,
                this.getListingOrder(request),
                this.getListingPage(request),
            );

            return this.toPagination(blockListResult, BlockResource, false);
        }
    }

    public async first(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object> {
        request.params.id = 1;
        return this.show(request, h);
    }

    public async last(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object> {
        request.params.id = this.blockchain.getLastHeight();
        return this.show(request, h);
    }

    public async show(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object> {
        if (request.query.transform) {
            const blockCriteria = this.getBlockCriteriaByIdOrHeight(request.params.id);
            const transactionCriteria = {
                typeGroup: Enums.TransactionTypeGroup.Core,
                type: Enums.TransactionType.Core.MultiPayment,
            };
            const block = await this.blockHistoryService.findOneByCriteriaJoinTransactions(
                blockCriteria,
                transactionCriteria,
            );
            if (!block) {
                return Boom.notFound("Block not found");
            }
            return this.respondWithResource(block, BlockWithTransactionsResource, true);
        } else {
            const blockCriteria = this.getBlockCriteriaByIdOrHeight(request.params.id);
            const blockData = await this.blockHistoryService.findOneByCriteria(blockCriteria);
            if (!blockData) {
                return Boom.notFound("Block not found");
            }
            return this.respondWithResource(blockData, BlockResource, false);
        }
    }

    public async transactions(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object> {
        const blockCriteria = this.getBlockCriteriaByIdOrHeight(request.params.id);
        const blockData = await this.blockHistoryService.findOneByCriteria(blockCriteria);
        if (!blockData) {
            return Boom.notFound("Block not found");
        }

        const transactionCriteria = { ...request.query, blockId: blockData.id! };
        const transactionListResult = await this.transactionHistoryService.listByCriteria(
            transactionCriteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            this.getListingOptions(),
        );

        return this.toPagination(transactionListResult, TransactionResource, request.query.transform);
    }

    private getBlockCriteriaByIdOrHeight(idOrHeight: string): Contracts.Shared.OrBlockCriteria {
        const asHeight = Number(idOrHeight);
        return asHeight && asHeight <= this.blockchain.getLastHeight() ? { height: asHeight } : { id: idOrHeight };
    }
}

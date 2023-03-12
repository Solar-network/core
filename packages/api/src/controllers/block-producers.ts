import { Boom, notFound } from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { BlockProductionFailureResource, BlockResource, BlockWithTransactionsResource } from "../resources";
import {
    BlockProducerCriteria,
    blockProducerCriteriaSchemaObject,
    BlockProducerResource,
    WalletCriteria,
    walletCriteriaSchemaObject,
    WalletResource,
} from "../resources-new";
import { BlockProducerSearchService, WalletSearchService } from "../services";
import { Controller } from "./controller";

@Container.injectable()
export class BlockProducersController extends Controller {
    @Container.inject(Identifiers.BlockProducerSearchService)
    private readonly blockProducerSearchService!: BlockProducerSearchService;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.BlockProductionFailureHistoryService)
    private readonly blockProductionFailureHistoryService!: Contracts.Shared.BlockProductionFailureHistoryService;

    public index(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<BlockProducerResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(
            request.query,
            blockProducerCriteriaSchemaObject,
        ) as BlockProducerCriteria;

        return this.blockProducerSearchService.getBlockProducersPage(
            pagination,
            sorting,
            !!request.query.count,
            criteria,
        );
    }

    public show(request: Hapi.Request, h: Hapi.ResponseToolkit): { data: BlockProducerResource } | Boom {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Block producer not found");
        }

        const blockProducerResource = this.blockProducerSearchService.getBlockProducer(walletResource.address);
        if (!blockProducerResource) {
            return notFound("Block producer not found");
        }

        return { data: blockProducerResource };
    }

    public voters(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<WalletResource> | Boom {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Block producer not found");
        }

        const blockProducerResource = this.blockProducerSearchService.getBlockProducer(walletResource.address);
        if (!blockProducerResource) {
            return notFound("Block producer not found");
        }

        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, walletCriteriaSchemaObject) as WalletCriteria;

        sorting.push({ property: `votingFor."${blockProducerResource.username}".votes`, direction: "desc" });

        return this.walletSearchService.getActiveWalletsPage(pagination, sorting, !!request.query.count, criteria, {
            votingFor: [{ [blockProducerResource.username]: "*" }],
        });
    }

    public async blocks(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Block producer not found");
        }

        const blockProducerResource = this.blockProducerSearchService.getBlockProducer(walletResource.address);
        if (!blockProducerResource) {
            return notFound("Block producer not found");
        }

        const blockCriteria = { ...request.query, username: blockProducerResource.username };

        if (request.query.transform) {
            const blockWithSomeTransactionsListResult = await this.blockHistoryService.listByCriteriaJoinTransactions(
                blockCriteria,
                { type: "transfer" },
                this.getListingOrder(request),
                this.getListingPage(request),
                !!request.query.count,
            );

            return this.toPagination(blockWithSomeTransactionsListResult, BlockWithTransactionsResource, true);
        } else {
            const blockListResult = await this.blockHistoryService.listByCriteria(
                blockCriteria,
                this.getListingOrder(request),
                this.getListingPage(request),
                !!request.query.count,
            );

            return this.toPagination(blockListResult, BlockResource, false);
        }
    }

    public async blockProductionFailures(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Block producer not found");
        }

        const blockProducerResource = this.blockProducerSearchService.getBlockProducer(walletResource.address);
        if (!blockProducerResource) {
            return notFound("Block producer not found");
        }

        const blockProductionFailureCriteria = { ...request.query, username: blockProducerResource.username };

        const blockProductionFailureListResult = await this.blockProductionFailureHistoryService.listByCriteria(
            blockProductionFailureCriteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            !!request.query.count,
        );

        return this.toPagination(blockProductionFailureListResult, BlockProductionFailureResource, true);
    }
}

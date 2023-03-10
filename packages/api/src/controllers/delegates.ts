import { Boom, notFound } from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Enums } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { BlockResource, BlockWithTransactionsResource, MissedBlockResource } from "../resources";
import {
    DelegateCriteria,
    delegateCriteriaSchemaObject,
    DelegateResource,
    WalletCriteria,
    walletCriteriaSchemaObject,
    WalletResource,
} from "../resources-new";
import { DelegateSearchService, WalletSearchService } from "../services";
import { Controller } from "./controller";

@Container.injectable()
export class DelegatesController extends Controller {
    @Container.inject(Identifiers.DelegateSearchService)
    private readonly delegateSearchService!: DelegateSearchService;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    @Container.inject(Container.Identifiers.BlockHistoryService)
    @Container.tagged("connection", "api")
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.MissedBlockHistoryService)
    @Container.tagged("connection", "api")
    private readonly missedBlockHistoryService!: Contracts.Shared.MissedBlockHistoryService;

    public index(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<DelegateResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, delegateCriteriaSchemaObject) as DelegateCriteria;

        return this.delegateSearchService.getDelegatesPage(pagination, sorting, criteria);
    }

    public show(request: Hapi.Request, h: Hapi.ResponseToolkit): { data: DelegateResource } | Boom {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Delegate not found");
        }

        const delegateResource = this.delegateSearchService.getDelegate(walletResource.address);
        if (!delegateResource) {
            return notFound("Delegate not found");
        }

        return { data: delegateResource };
    }

    public voters(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<WalletResource> | Boom {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Delegate not found");
        }

        const delegateResource = this.delegateSearchService.getDelegate(walletResource.address);
        if (!delegateResource) {
            return notFound("Delegate not found");
        }

        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, walletCriteriaSchemaObject) as WalletCriteria;

        return this.walletSearchService.getActiveWalletsPage(pagination, sorting, criteria, {
            votingFor: [{ [delegateResource.username]: "*" }],
        });
    }

    public async blocks(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Delegate not found");
        }

        const delegateResource = this.delegateSearchService.getDelegate(walletResource.address);
        if (!delegateResource) {
            return notFound("Delegate not found");
        }

        const blockCriteria = { ...request.query, username: delegateResource.username };

        if (request.query.transform) {
            const blockWithSomeTransactionsListResult = await this.blockHistoryService.listByCriteriaJoinTransactions(
                blockCriteria,
                { typeGroup: Enums.TransactionTypeGroup.Core, type: Enums.TransactionType.Core.Transfer },
                this.getListingOrder(request),
                this.getListingPage(request),
                this.getListingOptions(),
            );

            return this.toPagination(blockWithSomeTransactionsListResult, BlockWithTransactionsResource, true);
        } else {
            const blockListResult = await this.blockHistoryService.listByCriteria(
                blockCriteria,
                this.getListingOrder(request),
                this.getListingPage(request),
                this.getListingOptions(),
            );

            return this.toPagination(blockListResult, BlockResource, false);
        }
    }

    public async missedBlocks(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Delegate not found");
        }

        const delegateResource = this.delegateSearchService.getDelegate(walletResource.address);
        if (!delegateResource) {
            return notFound("Delegate not found");
        }

        const missedBlockCriteria = { ...request.query, username: delegateResource.username };

        const missedBlockListResult = await this.missedBlockHistoryService.listByCriteria(
            missedBlockCriteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            this.getListingOptions(),
        );

        return this.toPagination(missedBlockListResult, MissedBlockResource, true);
    }
}

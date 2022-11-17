import { badData, Boom, notFound } from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts, Services } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { TransactionResource, TransactionWithBlockResource } from "../resources";
import { WalletCriteria, walletCriteriaSchemaObject, WalletResource } from "../resources-new";
import { WalletSearchService } from "../services";
import { Controller } from "./controller";

@Container.injectable()
export class WalletsController extends Controller {
    @Container.inject(Container.Identifiers.PaginationService)
    private readonly paginationService!: Services.Search.PaginationService;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public index(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<WalletResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, walletCriteriaSchemaObject) as WalletCriteria;

        return this.walletSearchService.getWalletsPage(pagination, sorting, criteria);
    }

    public top(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<WalletResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, walletCriteriaSchemaObject) as WalletCriteria;

        return this.walletSearchService.getWalletsPage(pagination, sorting, criteria);
    }

    public show(request: Hapi.Request, h: Hapi.ResponseToolkit): { data: WalletResource } | Boom {
        const walletId = request.params.id as string;
        const walletResource = this.walletSearchService.getWallet(walletId);

        if (!walletResource) {
            return this.raiseError(walletId);
        }

        return { data: walletResource };
    }

    public async transactions(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;
        const walletResource = this.walletSearchService.getWallet(walletId);

        if (!walletResource) {
            return this.raiseError(walletId);
        }

        const criteria: Contracts.Shared.TransactionCriteria = { ...request.query, address: walletResource.address };
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

    public async transactionsSent(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;
        const walletResource = this.walletSearchService.getWallet(walletId);

        if (!walletResource) {
            return this.raiseError(walletId);
        }
        if (!walletResource.publicKeys || Object.keys(walletResource.publicKeys).length === 0) {
            return this.paginationService.getEmptyPage();
        }

        const criteria: Contracts.Shared.TransactionCriteria = {
            ...request.query,
            senderId: walletResource.address,
        };
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

    public async transactionsReceived(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;
        const walletResource = this.walletSearchService.getWallet(walletId);

        if (!walletResource) {
            return this.raiseError(walletId);
        }

        const criteria: Contracts.Shared.TransactionCriteria = {
            ...request.query,
            recipientId: walletResource.address,
        };
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

    public async votes(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Contracts.Search.ResultsPage<object> | Boom> {
        const walletId = request.params.id as string;
        const walletResource = this.walletSearchService.getWallet(walletId);

        if (!walletResource) {
            return this.raiseError(walletId);
        }
        if (!walletResource.publicKeys || Object.keys(walletResource.publicKeys).length === 0) {
            return this.paginationService.getEmptyPage();
        }

        const criteria: Contracts.Shared.TransactionCriteria = {
            ...request.query,
            type: "vote",
            senderId: walletResource.address,
        };

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

    private raiseError(walletId: string): Boom {
        if (walletId.length === 34) {
            return badData("Wallet not valid");
        }

        return notFound("Wallet not found");
    }
}

import { Boom, notFound } from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { UsernameCriteria, usernameCriteriaSchemaObject, UsernameResource } from "../resources-new";
import { UsernameSearchService, WalletSearchService } from "../services";
import { Controller } from "./controller";

@Container.injectable()
export class UsernamesController extends Controller {
    @Container.inject(Identifiers.UsernameSearchService)
    private readonly usernameSearchService!: UsernameSearchService;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    public index(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<UsernameResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, usernameCriteriaSchemaObject) as UsernameCriteria;

        return this.usernameSearchService.getUsernamesPage(pagination, sorting, !!request.query.count, criteria);
    }

    public show(request: Hapi.Request, h: Hapi.ResponseToolkit): { data: UsernameResource } | Boom {
        const walletId = request.params.id as string;

        const walletResource = this.walletSearchService.getWallet(walletId);
        if (!walletResource) {
            return notFound("Username not found");
        }

        const usernameResource = this.usernameSearchService.getUsername(walletResource.address);
        if (!usernameResource) {
            return notFound("Username not found");
        }

        return { data: usernameResource };
    }
}

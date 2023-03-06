import { Container, Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { UsernameCriteria, UsernameResource } from "../resources-new";

@Container.injectable()
export class UsernameSearchService {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.StandardCriteriaService)
    private readonly standardCriteriaService!: Services.Search.StandardCriteriaService;

    @Container.inject(Container.Identifiers.PaginationService)
    private readonly paginationService!: Services.Search.PaginationService;

    public getUsername(walletAddress: string): UsernameResource | undefined {
        if (!this.walletRepository.hasByAddress(walletAddress)) {
            return undefined;
        }

        const wallet = this.walletRepository.findByAddress(walletAddress);
        if (wallet.hasAttribute("username")) {
            return this.getUsernameResourceFromWallet(wallet);
        } else {
            return undefined;
        }
    }

    public getUsernamesPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        count: boolean = true,
        ...criterias: UsernameCriteria[]
    ): Contracts.Search.ResultsPage<UsernameResource> {
        sorting = [...sorting, { property: "rank", direction: "asc" }, { property: "username", direction: "asc" }];

        return this.paginationService.getPage(pagination, sorting, this.getUsernames(...criterias), count);
    }

    private getUsernameResourceFromWallet(wallet: Contracts.State.Wallet): UsernameResource {
        AppUtils.assert.defined<string>(wallet.getPublicKey("primary"));

        const address = wallet.getAddress();
        const publicKey = wallet.getPublicKey("primary")!;
        const blockProducer = wallet.hasAttribute("blockProducer");
        const username = wallet.getAttribute("username");

        return {
            address,
            blockProducer,
            username,
            publicKey,
        };
    }

    private *getUsernames(...criterias: UsernameCriteria[]): Iterable<UsernameResource> {
        for (const wallet of this.walletRepository.allByUsername()) {
            const usernameResource = this.getUsernameResourceFromWallet(wallet);

            if (this.standardCriteriaService.testStandardCriterias(usernameResource, ...criterias)) {
                yield usernameResource;
            }
        }
    }
}

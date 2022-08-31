import { Enums, Identities } from "@solar-network/crypto";
import { Container, Contracts, Services } from "@solar-network/kernel";

import { WalletCriteria, WalletResource, WalletSearchResource } from "../resources-new";

@Container.injectable()
export class WalletSearchService {
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.StandardCriteriaService)
    private readonly standardCriteriaService!: Services.Search.StandardCriteriaService;

    @Container.inject(Container.Identifiers.PaginationService)
    private readonly paginationService!: Services.Search.PaginationService;

    public getWallet(walletId: string): WalletResource | undefined {
        let wallet: Contracts.State.Wallet | undefined;

        if (this.walletRepository.hasByAddress(walletId)) {
            wallet = this.walletRepository.findByAddress(walletId);
        }

        if (!wallet && this.walletRepository.hasByPublicKey(walletId)) {
            wallet = this.walletRepository.findByPublicKey(walletId);
        }

        if (!wallet && this.walletRepository.hasByUsername(walletId)) {
            wallet = this.walletRepository.findByUsername(walletId);
        }

        if (!wallet && Identities.Address.validate(walletId)) {
            wallet = this.walletRepository.createWallet(walletId);
        }

        if (wallet) {
            return this.getWalletResourceFromWallet(wallet);
        }

        return undefined;
    }

    public getWalletsLike(criteria: string): WalletSearchResource[] {
        criteria = criteria.toLowerCase();
        return this.walletRepository
            .allByAddress()
            .filter((wallet) => {
                const publicKey: string = wallet.hasPublicKey() ? wallet.getPublicKey()!.toLowerCase() : "";
                const delegateAttributes: Record<string, any> = wallet.hasAttribute("delegate")
                    ? wallet.getAttribute("delegate")
                    : {};
                if (criteria.length < 34) {
                    if (criteria.length <= 20) {
                        return delegateAttributes.username && delegateAttributes.username.startsWith(criteria);
                    } else {
                        return wallet.getAddress().toLowerCase().startsWith(criteria) || publicKey.startsWith(criteria);
                    }
                } else {
                    return (
                        criteria === wallet.getAddress().toLowerCase() ||
                        (criteria.length > 20 && criteria === publicKey)
                    );
                }
            })
            .slice(0, 100)
            .map((wallet) => {
                let delegate: Record<string, any> | undefined;
                if (wallet.hasAttribute("delegate")) {
                    const isResigned = wallet.hasAttribute("delegate.resigned");
                    let resigned: string | undefined;
                    if (isResigned) {
                        resigned =
                            wallet.getAttribute("delegate.resigned") === Enums.DelegateStatus.PermanentResign
                                ? "permanent"
                                : "temporary";
                    }
                    delegate = {
                        rank: wallet.hasAttribute("delegate.rank") ? wallet.getAttribute("delegate.rank") : undefined,
                        resigned,
                        username: wallet.getAttribute("delegate.username"),
                        voters: wallet.getAttribute("delegate.voters"),
                        votes: wallet.getAttribute("delegate.voteBalance"),
                    };
                }
                return {
                    address: wallet.getAddress(),
                    delegate,
                    publicKey: wallet.getPublicKey(),
                    balance: wallet.getBalance(),
                    votes: wallet.getVoteDistribution(),
                };
            })
            .sort((a, b) => {
                if (a.delegate && !a.delegate.resigned && !b.delegate) {
                    return -1;
                } else if (b.delegate && !b.delegate.resigned && !a.delegate) {
                    return 1;
                } else if (a.delegate && b.delegate && !a.delegate.resigned && !b.delegate.resigned) {
                    return a.delegate.username.localeCompare(b.delegate.username, "en", { numeric: true });
                } else {
                    return a.address.localeCompare(b.address, "en", { numeric: true });
                }
            });
    }

    public getWalletsPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        ...criterias: WalletCriteria[]
    ): Contracts.Search.ResultsPage<WalletResource> {
        sorting = [...sorting, { property: "balance", direction: "desc" }];

        return this.paginationService.getPage(pagination, sorting, this.getWallets(...criterias));
    }

    public getActiveWalletsPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        ...criterias: WalletCriteria[]
    ): Contracts.Search.ResultsPage<WalletResource> {
        sorting = [...sorting, { property: "balance", direction: "desc" }];

        return this.paginationService.getPage(pagination, sorting, this.getActiveWallets(...criterias));
    }

    private getWalletResourceFromWallet(wallet: Contracts.State.Wallet): WalletResource {
        return wallet.getBasicWallet();
    }

    private *getWallets(...criterias: WalletCriteria[]): Iterable<WalletResource> {
        for (const wallet of this.walletRepository.allByAddress()) {
            const walletResource = this.getWalletResourceFromWallet(wallet);

            if (this.standardCriteriaService.testStandardCriterias(walletResource, ...criterias)) {
                yield walletResource;
            }
        }
    }

    private *getActiveWallets(...criterias: WalletCriteria[]): Iterable<WalletResource> {
        for (const wallet of this.walletRepository.allByPublicKey()) {
            const walletResource = this.getWalletResourceFromWallet(wallet);

            if (this.standardCriteriaService.testStandardCriterias(walletResource, ...criterias)) {
                yield walletResource;
            }
        }
    }
}

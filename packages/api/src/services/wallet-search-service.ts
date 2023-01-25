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
                const publicKeys: string[] = [];
                const walletKeys = Object.values(wallet.getPublicKeys());
                for (const key of walletKeys) {
                    if (typeof key === "string") {
                        publicKeys.push(key.toLowerCase());
                    } else {
                        publicKeys.push(...Object.keys(key).map((key) => key.toLowerCase()));
                    }
                }
                if (criteria.length <= 20) {
                    return wallet.hasAttribute("username") && wallet.getAttribute("username").startsWith(criteria);
                } else {
                    return (
                        wallet.getAddress().toLowerCase().startsWith(criteria) ||
                        publicKeys.filter((publicKey) => publicKey.startsWith(criteria)).length > 0
                    );
                }
            })
            .slice(0, 100)
            .map((wallet) => {
                let blockProducer: Record<string, any> | undefined;
                if (wallet.hasAttribute("blockProducer")) {
                    const isResigned = wallet.hasAttribute("blockProducer.resignation");
                    let resigned: string | undefined;
                    if (isResigned) {
                        resigned =
                            wallet.getAttribute("blockProducer.resignation.type") ===
                            Enums.BlockProducerStatus.PermanentResign
                                ? "permanent"
                                : "temporary";
                    }
                    blockProducer = {
                        rank: wallet.hasAttribute("blockProducer.rank")
                            ? wallet.getAttribute("blockProducer.rank")
                            : undefined,
                        resigned,
                        voters: wallet.getAttribute("blockProducer.voters"),
                        votes: wallet.getAttribute("blockProducer.voteBalance"),
                    };
                }
                return {
                    address: wallet.getAddress(),
                    blockProducer,
                    publicKeys: wallet.getPublicKeys(),
                    balance: wallet.getBalance(),
                    votes: Object.fromEntries(wallet.getVoteDistribution().entries()),
                    username: wallet.getAttribute("username"),
                };
            })
            .sort((a, b) => {
                if (a.blockProducer && !a.blockProducer.resignation && !b.blockProducer) {
                    return -1;
                } else if (b.blockProducer && !b.blockProducer.resignation && !a.blockProducer) {
                    return 1;
                } else if (
                    a.blockProducer &&
                    b.blockProducer &&
                    !a.blockProducer.resignation &&
                    !b.blockProducer.resignation
                ) {
                    return a.username.localeCompare(b.username, "en", { numeric: true });
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

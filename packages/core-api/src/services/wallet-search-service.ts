import { Container, Contracts, Services, Utils } from "@solar-network/core-kernel";
import { Enums, Identities } from "@solar-network/crypto";

import { WalletCriteria, WalletResource } from "../resources-new";

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
        const attributes: Record<string, any> = Utils.cloneDeep(wallet.getAttributes());

        let resigned: string | undefined = undefined;
        if (wallet.hasAttribute("delegate.resigned")) {
            switch (wallet.getAttribute("delegate.resigned")) {
                case Enums.DelegateStatus.PermanentResign: {
                    resigned = "permanent";
                    break;
                }
                case Enums.DelegateStatus.TemporaryResign: {
                    resigned = "temporary";
                    break;
                }
            }
            attributes.delegate.resigned = resigned;
        }

        return {
            address: wallet.getAddress(),
            publicKey: wallet.getPublicKey(),
            balance: wallet.getBalance(),
            nonce: wallet.getNonce(),
            attributes: { ...attributes, votes: undefined },
            votingFor: wallet.getVoteDistribution(),
        };
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

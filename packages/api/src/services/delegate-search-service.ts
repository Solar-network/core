import { Enums, Managers } from "@solar-network/crypto";
import { Container, Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { DelegateCriteria, DelegateResource } from "../resources-new";

@Container.injectable()
export class DelegateSearchService {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.StandardCriteriaService)
    private readonly standardCriteriaService!: Services.Search.StandardCriteriaService;

    @Container.inject(Container.Identifiers.PaginationService)
    private readonly paginationService!: Services.Search.PaginationService;

    public getDelegate(walletAddress: string): DelegateResource | undefined {
        if (!this.walletRepository.hasByAddress(walletAddress)) {
            return undefined;
        }

        const wallet = this.walletRepository.findByAddress(walletAddress);
        const supply: string = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
        const ourKeys: string[] = AppUtils.getForgerDelegates();
        if (wallet.hasAttribute("delegate")) {
            return this.getDelegateResourceFromWallet(wallet, supply, ourKeys);
        } else {
            return undefined;
        }
    }

    public getDelegatesPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        ...criterias: DelegateCriteria[]
    ): Contracts.Search.ResultsPage<DelegateResource> {
        sorting = [...sorting, { property: "rank", direction: "asc" }, { property: "username", direction: "asc" }];

        return this.paginationService.getPage(pagination, sorting, this.getDelegates(...criterias));
    }

    private getDelegateResourceFromWallet(
        wallet: Contracts.State.Wallet,
        supply: string,
        ourKeys: string[],
    ): DelegateResource {
        AppUtils.assert.defined<string>(wallet.getPublicKey("primary"));

        const publicKey = wallet.getPublicKey("primary")!;

        const delegateAttribute = wallet.getAttribute("delegate");

        const activeDelegates: number = Managers.configManager.getMilestone().activeDelegates;

        if (!delegateAttribute.version && ourKeys.includes(publicKey!)) {
            wallet.setAttribute("delegate.version", this.app.version());
        }

        let resignation: string | undefined = undefined;

        if (delegateAttribute.resignation?.type === Enums.DelegateStatus.PermanentResign) {
            resignation = "permanent";
        } else if (delegateAttribute.resignation?.type === Enums.DelegateStatus.TemporaryResign) {
            resignation = "temporary";
        }

        return {
            username: delegateAttribute.username,
            address: wallet.getAddress(),
            publicKey: publicKey!,
            votesReceived: {
                percent: AppUtils.delegateCalculator.calculateVotePercent(wallet, supply),
                votes: delegateAttribute.voteBalance,
                voters: delegateAttribute.voters,
            },
            rank: delegateAttribute.rank,
            resignation,
            blocks: {
                produced: delegateAttribute.producedBlocks,
                missed: delegateAttribute.missedBlocks,
                productivity: delegateAttribute.productivity,
                last: delegateAttribute.lastBlock,
            },
            forged: {
                fees: delegateAttribute.forgedFees,
                burnedFees: delegateAttribute.burnedFees,
                rewards: delegateAttribute.forgedRewards,
                donations: delegateAttribute.donations,
                total: delegateAttribute.forgedFees
                    .minus(delegateAttribute.burnedFees)
                    .plus(delegateAttribute.forgedRewards)
                    .minus(delegateAttribute.donations),
            },
            version:
                delegateAttribute.version && delegateAttribute.rank && delegateAttribute.rank <= activeDelegates
                    ? new AppUtils.Semver(delegateAttribute.version)
                    : undefined,
        };
    }

    private *getDelegates(...criterias: DelegateCriteria[]): Iterable<DelegateResource> {
        const supply: string = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
        const ourKeys: string[] = AppUtils.getForgerDelegates();

        for (const wallet of this.walletRepository.allByUsername()) {
            const delegateResource = this.getDelegateResourceFromWallet(wallet, supply, ourKeys);

            if (this.standardCriteriaService.testStandardCriterias(delegateResource, ...criterias)) {
                yield delegateResource;
            }
        }
    }
}

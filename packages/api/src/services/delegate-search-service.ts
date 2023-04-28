import { Enums } from "@solar-network/crypto";
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
        if (wallet.hasAttribute("delegate")) {
            return this.getDelegateResourceFromWallet(wallet, supply);
        } else {
            return undefined;
        }
    }

    public async getDelegatesPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        ...criterias: DelegateCriteria[]
    ): Promise<Contracts.Search.ResultsPage<DelegateResource>> {
        sorting = [...sorting, { property: "rank", direction: "asc" }, { property: "username", direction: "asc" }];

        return this.paginationService.getPage(pagination, sorting, this.getDelegates(...criterias));
    }

    private getDelegateResourceFromWallet(wallet: Contracts.State.Wallet, supply: string): DelegateResource {
        AppUtils.assert.defined<string>(wallet.getPublicKey());

        const publicKey = wallet.getPublicKey();

        const delegateAttribute = wallet.getAttribute("delegate");

        let resignationType: string | undefined = undefined;

        if (delegateAttribute.resigned === Enums.DelegateStatus.PermanentResign) {
            resignationType = "permanent";
        } else if (delegateAttribute.resigned === Enums.DelegateStatus.TemporaryResign) {
            resignationType = "temporary";
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
            isResigned: delegateAttribute.resigned !== undefined,
            resignationType,
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
            version: delegateAttribute.version?.version
                ? new AppUtils.Semver(delegateAttribute.version.version)
                : undefined,
        };
    }

    private *getDelegates(...criterias: DelegateCriteria[]): Iterable<DelegateResource> {
        const supply: string = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());

        for (const wallet of this.walletRepository.allByUsername()) {
            const delegateResource = this.getDelegateResourceFromWallet(wallet, supply);

            if (this.standardCriteriaService.testStandardCriterias(delegateResource, ...criterias)) {
                yield delegateResource;
            }
        }
    }
}

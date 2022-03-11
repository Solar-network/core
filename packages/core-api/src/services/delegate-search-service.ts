import { Container, Contracts, Services, Utils as AppUtils } from "@solar-network/core-kernel";
import { Managers } from "@solar-network/crypto";
import { Semver } from "@solar-network/utils";

import { DelegateCriteria, DelegateResource, DelegateResourceLastBlock } from "../resources-new";

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
        sorting = [...sorting, { property: "rank", direction: "asc" }];

        return this.paginationService.getPage(pagination, sorting, this.getDelegates(...criterias));
    }

    private getDelegateResourceFromWallet(
        wallet: Contracts.State.Wallet,
        supply: string,
        ourKeys: string[],
    ): DelegateResource {
        AppUtils.assert.defined<string>(wallet.getPublicKey());

        const publicKey = wallet.getPublicKey();

        const delegateAttribute = wallet.getAttribute("delegate");

        let delegateLastBlock: DelegateResourceLastBlock | undefined;

        const activeDelegates: number = Managers.configManager.getMilestone().activeDelegates;

        if (delegateAttribute.lastBlock) {
            delegateLastBlock = {
                id: delegateAttribute.lastBlock.id,
                height: delegateAttribute.lastBlock.height,
                timestamp: AppUtils.formatTimestamp(delegateAttribute.lastBlock.timestamp),
            };
        }

        if (!delegateAttribute.version && ourKeys.includes(publicKey!)) {
            wallet.setAttribute("delegate.version", this.app.version());
        }

        return {
            username: delegateAttribute.username,
            address: wallet.getAddress(),
            publicKey: publicKey!,
            votes: delegateAttribute.voteBalance,
            rank: delegateAttribute.rank,
            isResigned: !!delegateAttribute.resigned,
            blocks: {
                produced: delegateAttribute.producedBlocks,
                last: delegateLastBlock,
            },
            production: {
                approval: AppUtils.delegateCalculator.calculateApproval(wallet, supply),
            },
            forged: {
                fees: delegateAttribute.forgedFees,
                burnedFees: delegateAttribute.burnedFees,
                rewards: delegateAttribute.forgedRewards,
                total: delegateAttribute.forgedFees
                    .minus(delegateAttribute.burnedFees)
                    .plus(delegateAttribute.forgedRewards),
            },
            version:
                delegateAttribute.version && delegateAttribute.rank && delegateAttribute.rank <= activeDelegates
                    ? new Semver(delegateAttribute.version)
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

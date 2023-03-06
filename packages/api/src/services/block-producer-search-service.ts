import { Enums, Managers } from "@solar-network/crypto";
import { Container, Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { BlockProducerCriteria, BlockProducerResource } from "../resources-new";

@Container.injectable()
export class BlockProducerSearchService {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.StandardCriteriaService)
    private readonly standardCriteriaService!: Services.Search.StandardCriteriaService;

    @Container.inject(Container.Identifiers.PaginationService)
    private readonly paginationService!: Services.Search.PaginationService;

    public getBlockProducer(walletAddress: string): BlockProducerResource | undefined {
        if (!this.walletRepository.hasByAddress(walletAddress)) {
            return undefined;
        }

        const wallet = this.walletRepository.findByAddress(walletAddress);
        if (wallet.hasAttribute("blockProducer")) {
            const supply: string = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
            const ourKeys: string[] = AppUtils.getConfiguredBlockProducers();
            return this.getBlockProducerResourceFromWallet(wallet, supply, ourKeys);
        } else {
            return undefined;
        }
    }

    public getBlockProducersPage(
        pagination: Contracts.Search.Pagination,
        sorting: Contracts.Search.Sorting,
        count: boolean = true,
        ...criterias: BlockProducerCriteria[]
    ): Contracts.Search.ResultsPage<BlockProducerResource> {
        sorting = [...sorting, { property: "rank", direction: "asc" }, { property: "username", direction: "asc" }];

        return this.paginationService.getPage(pagination, sorting, this.getBlockProducers(...criterias), count);
    }

    private getBlockProducerResourceFromWallet(
        wallet: Contracts.State.Wallet,
        supply: string,
        ourKeys: string[],
    ): BlockProducerResource {
        AppUtils.assert.defined<string>(wallet.getPublicKey("primary"));

        const publicKey = wallet.getPublicKey("primary")!;

        const blockProducerAttribute = wallet.getAttribute("blockProducer");

        const activeBlockProducers: number = Managers.configManager.getMilestone().activeBlockProducers;

        if (!blockProducerAttribute.version && ourKeys.includes(publicKey!)) {
            wallet.setAttribute("blockProducer.version", this.app.version());
        }

        let resignation: string | undefined = undefined;

        if (blockProducerAttribute.resignation === Enums.BlockProducerStatus.PermanentResign) {
            resignation = "permanent";
        } else if (blockProducerAttribute.resignation === Enums.BlockProducerStatus.TemporaryResign) {
            resignation = "temporary";
        }

        return {
            username: wallet.getAttribute("username"),
            address: wallet.getAddress(),
            publicKey,
            votesReceived: {
                percent: AppUtils.blockProducerCalculator.calculateVotePercent(wallet, supply),
                votes: blockProducerAttribute.voteBalance,
                voters: blockProducerAttribute.voters,
            },
            rank: blockProducerAttribute.rank,
            resignation,
            blocks: {
                produced: blockProducerAttribute.producedBlocks,
                failed: blockProducerAttribute.failures,
                reliability: blockProducerAttribute.reliability,
                last: blockProducerAttribute.lastBlock,
            },
            collected: {
                fees: {
                    burned: blockProducerAttribute.burnedFees,
                    retained: blockProducerAttribute.fees.minus(blockProducerAttribute.burnedFees),
                    total: blockProducerAttribute.fees,
                },
                rewards: blockProducerAttribute.rewards,
                donations: blockProducerAttribute.donations,
                total: blockProducerAttribute.fees
                    .minus(blockProducerAttribute.burnedFees)
                    .plus(blockProducerAttribute.rewards)
                    .minus(blockProducerAttribute.donations),
            },
            version:
                blockProducerAttribute.version &&
                blockProducerAttribute.rank &&
                blockProducerAttribute.rank <= activeBlockProducers
                    ? new AppUtils.Semver(blockProducerAttribute.version)
                    : undefined,
        };
    }

    private *getBlockProducers(...criterias: BlockProducerCriteria[]): Iterable<BlockProducerResource> {
        const supply: string = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
        const ourKeys: string[] = AppUtils.getConfiguredBlockProducers();

        for (const wallet of this.walletRepository.allBlockProducers()) {
            const blockProducerResource = this.getBlockProducerResourceFromWallet(wallet, supply, ourKeys);

            if (this.standardCriteriaService.testStandardCriterias(blockProducerResource, ...criterias)) {
                yield blockProducerResource;
            }
        }
    }
}

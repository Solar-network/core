import { Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

@Container.injectable()
export class DposState implements Contracts.State.DposState {
    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    private walletRepository!: Contracts.State.WalletRepository;

    private roundInfo: Contracts.Shared.RoundInfo | null = null;

    private activeBlockProducers: Contracts.State.Wallet[] = [];

    private roundBlockProducers: Contracts.State.Wallet[] = [];

    public getRoundInfo(): Contracts.Shared.RoundInfo {
        AppUtils.assert.defined<Contracts.Shared.RoundInfo>(this.roundInfo);
        return this.roundInfo;
    }

    public getAllBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.walletRepository.allBlockProducers();
    }

    public getActiveBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.activeBlockProducers;
    }

    public getRoundBlockProducers(): readonly Contracts.State.Wallet[] {
        return this.roundBlockProducers;
    }

    // Only called during integrity verification on boot.
    public buildVoteBalances(): void {
        for (const voter of this.walletRepository.allByPublicKey()) {
            if (voter.hasVoted()) {
                voter.updateVoteBalances();
                const blockProducers: Map<string, Contracts.State.WalletVoteDistribution> = voter.getVoteDistribution();
                for (const [blockProducer, { votes }] of blockProducers.entries()) {
                    const blockProducerWallet = this.walletRepository.findByUsername(blockProducer);
                    const voteBalance: Utils.BigNumber = blockProducerWallet.getAttribute(
                        "blockProducer.voteBalance",
                        Utils.BigNumber.ZERO,
                    );

                    blockProducerWallet.setAttribute("blockProducer.voteBalance", voteBalance.plus(votes));
                    blockProducerWallet.setAttribute(
                        "blockProducer.voters",
                        blockProducerWallet.getAttribute("blockProducer.voters") + 1,
                    );
                }
            }
        }
    }

    public buildBlockProducerRanking(roundInfo?: Contracts.Shared.RoundInfo): void {
        this.activeBlockProducers = [];
        if (!roundInfo) {
            roundInfo = AppUtils.roundCalculator.calculateRound(this.stateStore.getLastBlock().data.height);
        }

        for (const blockProducer of this.walletRepository.allBlockProducers()) {
            let push = true;
            if (blockProducer.hasAttribute("hidden.upgradeRound")) {
                const upgradeRound = blockProducer.getAttribute("hidden.upgradeRound");
                if (upgradeRound === roundInfo.round && roundInfo.round > 1) {
                    blockProducer.forgetAttribute("blockProducer.rank");
                    push = false;
                }
            }

            if (blockProducer.hasAttribute("blockProducer.resignation")) {
                blockProducer.forgetAttribute("blockProducer.rank");
                push = false;
            } else if (blockProducer.hasAttribute("hidden.resignationRound")) {
                const resignationRound = blockProducer.getAttribute("hidden.resignationRound");
                if (resignationRound === roundInfo.round) {
                    blockProducer.forgetAttribute("blockProducer.rank");
                    push = false;
                }
            }

            if (push) {
                this.activeBlockProducers.push(blockProducer);
            }
        }

        this.activeBlockProducers.sort((a, b) => {
            const voteBalanceA: Utils.BigNumber = a.getAttribute("blockProducer.voteBalance");
            const voteBalanceB: Utils.BigNumber = b.getAttribute("blockProducer.voteBalance");

            const diff = voteBalanceB.comparedTo(voteBalanceA);

            if (diff === 0) {
                AppUtils.assert.defined<string>(a.getPublicKey("primary"));
                AppUtils.assert.defined<string>(b.getPublicKey("primary"));

                if (a.getPublicKey("primary") === b.getPublicKey("primary")) {
                    const username = a.getAttribute("username");
                    throw new Error(
                        `The balance and public key of both block producers are identical: "${username}" appears twice in the list`,
                    );
                }

                return a.getPublicKey("primary")!.localeCompare(b.getPublicKey("primary")!, "en");
            }

            return diff;
        });

        for (let i = 0; i < this.activeBlockProducers.length; i++) {
            this.activeBlockProducers[i].setAttribute("blockProducer.rank", i + 1);
        }
    }

    public setBlockProducersRound(roundInfo: Contracts.Shared.RoundInfo): void {
        if (this.activeBlockProducers.length < roundInfo.maxBlockProducers) {
            throw new Error(
                `Expected to find ${roundInfo.maxBlockProducers} block producers but only found ${this.activeBlockProducers.length}`,
            );
        }

        this.roundInfo = roundInfo;
        this.roundBlockProducers = [];
        for (let i = 0; i < roundInfo.maxBlockProducers; i++) {
            this.activeBlockProducers[i].setAttribute("blockProducer.round", roundInfo.round);
            this.roundBlockProducers.push(this.activeBlockProducers[i]);
        }
    }
}

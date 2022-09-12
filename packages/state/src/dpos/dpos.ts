import { Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

@Container.injectable()
export class DposState implements Contracts.State.DposState {
    @Container.inject(Container.Identifiers.LogService)
    private logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.WalletRepository)
    private walletRepository!: Contracts.State.WalletRepository;

    private roundInfo: Contracts.Shared.RoundInfo | null = null;

    private activeDelegates: Contracts.State.Wallet[] = [];

    private roundDelegates: Contracts.State.Wallet[] = [];

    public getRoundInfo(): Contracts.Shared.RoundInfo {
        AppUtils.assert.defined<Contracts.Shared.RoundInfo>(this.roundInfo);
        return this.roundInfo;
    }

    public getAllDelegates(): readonly Contracts.State.Wallet[] {
        return this.walletRepository.allByUsername();
    }

    public getActiveDelegates(): readonly Contracts.State.Wallet[] {
        return this.activeDelegates;
    }

    public getRoundDelegates(): readonly Contracts.State.Wallet[] {
        return this.roundDelegates;
    }

    // Only called during integrity verification on boot.
    public buildVoteBalances(): void {
        for (const voter of this.walletRepository.allByPublicKey()) {
            if (voter.hasVoted()) {
                voter.updateVoteBalances();
                const delegates: Record<string, Contracts.State.WalletVoteDistribution> = voter.getVoteDistribution();
                for (const delegate of Object.keys(delegates)) {
                    const delegateWallet = this.walletRepository.findByUsername(delegate);
                    const voteBalance: Utils.BigNumber = delegateWallet.getAttribute(
                        "delegate.voteBalance",
                        Utils.BigNumber.ZERO,
                    );

                    delegateWallet.setAttribute("delegate.voteBalance", voteBalance.plus(delegates[delegate].votes));
                    delegateWallet.setAttribute("delegate.voters", delegateWallet.getAttribute("delegate.voters") + 1);
                }
            }
        }
    }

    public buildDelegateRanking(): void {
        this.activeDelegates = [];

        for (const delegate of this.walletRepository.allByUsername()) {
            if (delegate.hasAttribute("delegate.resigned")) {
                delegate.forgetAttribute("delegate.rank");
            } else {
                this.activeDelegates.push(delegate);
            }
        }

        this.activeDelegates.sort((a, b) => {
            const voteBalanceA: Utils.BigNumber = a.getAttribute("delegate.voteBalance");
            const voteBalanceB: Utils.BigNumber = b.getAttribute("delegate.voteBalance");

            const diff = voteBalanceB.comparedTo(voteBalanceA);

            if (diff === 0) {
                AppUtils.assert.defined<string>(a.getPublicKey("primary"));
                AppUtils.assert.defined<string>(b.getPublicKey("primary"));

                if (a.getPublicKey("primary") === b.getPublicKey("primary")) {
                    const username = a.getAttribute("delegate.username");
                    throw new Error(
                        `The balance and public key of both delegates are identical! ` +
                            `Delegate "${username}" appears twice in the list`,
                    );
                }

                return a.getPublicKey("primary").localeCompare(b.getPublicKey("primary"), "en");
            }

            return diff;
        });

        for (let i = 0; i < this.activeDelegates.length; i++) {
            this.activeDelegates[i].setAttribute("delegate.rank", i + 1);
        }
    }

    public setDelegatesRound(roundInfo: Contracts.Shared.RoundInfo): void {
        if (this.activeDelegates.length < roundInfo.maxDelegates) {
            throw new Error(
                `Expected to find ${roundInfo.maxDelegates} delegates but only found ${this.activeDelegates.length}. ` +
                    `This indicates an issue with the genesis block and delegates`,
            );
        }

        this.roundInfo = roundInfo;
        this.roundDelegates = [];
        for (let i = 0; i < roundInfo.maxDelegates; i++) {
            this.activeDelegates[i].setAttribute("delegate.round", roundInfo.round);
            this.roundDelegates.push(this.activeDelegates[i]);
        }
        this.logger.debug(
            `Loaded ${roundInfo.maxDelegates} active ` + AppUtils.pluralise("delegate", roundInfo.maxDelegates),
        );
    }
}

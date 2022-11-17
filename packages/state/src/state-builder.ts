import { Identities, Managers, Utils } from "@solar-network/crypto";
import { Application, Container, Contracts, Enums, Services } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

// todo: review the implementation
@Container.injectable()
export class StateBuilder {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private blockRepository!: Contracts.Database.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private transactionRepository!: Contracts.Database.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.DposState)
    @Container.tagged("state", "blockchain")
    private dposState!: Contracts.State.DposState;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.ConfigRepository)
    private readonly configRepository!: Services.Config.ConfigRepository;

    public async run(): Promise<void> {
        this.events = this.app.get<Contracts.Kernel.EventDispatcher>(Container.Identifiers.EventDispatcherService);

        const registeredHandlers = this.app
            .getTagged<Handlers.Registry>(Container.Identifiers.TransactionHandlerRegistry, "state", "blockchain")
            .getRegisteredHandlers();
        const steps = registeredHandlers.length + 3;

        try {
            const capitalise = (key: string) => key[0].toUpperCase() + key.slice(1);
            for (let i = 0; i < registeredHandlers.length; i++) {
                const handler = registeredHandlers[i];
                const { emoji, key } = handler.getConstructor();
                this.logger.info(`State Generation - Step ${1 + i} of ${steps}: ${capitalise(key)}`, emoji);
                await handler.bootstrap();
            }

            this.logger.info(`State Generation - Step ${steps - 2} of ${steps}: Fees & Nonces`, "📉");
            await this.buildSentTransactions();

            this.logger.info(`State Generation - Step ${steps - 1} of ${steps}: Block Rewards`, "📈");
            await this.buildBlockRewards();

            this.logger.info(`State Generation - Step ${steps} of ${steps}: Vote Balances & Delegate Ranking`, "🏅");
            this.dposState.buildVoteBalances();
            this.dposState.buildDelegateRanking();

            this.verifyWalletsConsistency();

            this.events.dispatch(Enums.StateEvent.BuilderFinished);
        } catch (ex) {
            this.logger.error(ex.stack);
        }
    }

    private async buildBlockRewards(): Promise<void> {
        const blocks = await this.blockRepository.getBlockRewards();

        for (const block of blocks) {
            if (block.username) {
                const wallet = this.walletRepository.findByUsername(block.username);
                wallet.increaseBalance(Utils.BigNumber.make(block.rewards));
            }
        }

        const donations = await this.blockRepository.calculateDonations();

        for (const donation of donations) {
            const donationWallet = this.walletRepository.findByAddress(donation.address);
            donationWallet.increaseBalance(donation.amount);

            const delegateWallet = this.walletRepository.findByUsername(donation.username);
            delegateWallet.decreaseBalance(donation.amount);
        }
    }

    private async buildSentTransactions(): Promise<void> {
        const transactions = await this.transactionRepository.getSentTransactions();

        for (const transaction of transactions) {
            const wallet = this.walletRepository.findByAddress(transaction.senderId);
            wallet.setNonce(Utils.BigNumber.make(transaction.nonce));
            wallet.decreaseBalance(Utils.BigNumber.make(transaction.fee));
        }
    }

    private verifyWalletsConsistency(): void {
        const logNegativeBalance = (wallet, type, balance) =>
            this.logger.warning(`Wallet ${wallet.address} has a negative ${type} of ${balance}`);

        const genesisAddress: string = Identities.Address.fromPublicKey(
            Managers.configManager.get("genesisBlock.transactions")[0].senderPublicKey,
        );
        for (const wallet of this.walletRepository.allByAddress()) {
            const address: string = wallet.getAddress();
            const balance: Utils.BigNumber = wallet.getBalance();

            if (balance.isLessThan(0) && (address === undefined || address !== genesisAddress)) {
                const negativeBalanceExceptions: Record<string, Record<string, string>> = this.configRepository.get(
                    "crypto.exceptions.negativeBalances",
                    {},
                );

                const whitelistedNegativeBalances: Record<string, string> | undefined = address
                    ? negativeBalanceExceptions[address]
                    : undefined;

                if (!whitelistedNegativeBalances) {
                    logNegativeBalance(wallet, "balance", balance);
                    throw new Error("Non-genesis wallet with negative balance");
                }

                const allowedNegativeBalance = balance.isEqualTo(
                    whitelistedNegativeBalances[wallet.getNonce().toString()],
                );

                if (!allowedNegativeBalance) {
                    logNegativeBalance(wallet, "balance", balance);
                    throw new Error("Non-genesis wallet with negative balance");
                }
            }

            if (wallet.hasAttribute("delegate.voteBalance")) {
                const voteBalance: Utils.BigNumber = wallet.getAttribute("delegate.voteBalance");

                if (voteBalance.isLessThan(0)) {
                    logNegativeBalance(wallet, "vote balance", voteBalance);
                    throw new Error("Wallet with negative vote balance");
                }
            }
        }
    }
}

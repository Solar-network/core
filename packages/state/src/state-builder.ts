import { Managers, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Application, Container, Contracts, Enums, Services, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

// todo: review the implementation
@Container.injectable()
export class StateBuilder {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private blockRepository!: Repositories.BlockRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private transactionRepository!: Repositories.TransactionRepository;

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
            this.logger.info(`State Generation - Step 1 of ${steps}: Fees & Nonces`);
            await this.buildSentTransactions();

            const capitalise = (key: string) => key[0].toUpperCase() + key.slice(1);
            for (let i = 0; i < registeredHandlers.length; i++) {
                const handler = registeredHandlers[i];
                const ctorKey: string | undefined = handler.getConstructor().key;
                AppUtils.assert.defined<string>(ctorKey);

                this.logger.info(`State Generation - Step ${2 + i} of ${steps}: ${capitalise(ctorKey)}`);
                await handler.bootstrap();
            }

            this.logger.info(`State Generation - Step ${steps - 1} of ${steps}: Block Rewards`);
            await this.buildBlockRewards();

            this.logger.info(`State Generation - Step ${steps} of ${steps}: Vote Balances & Delegate Ranking`);
            this.dposState.buildVoteBalances();
            this.dposState.buildDelegateRanking();

            this.logger.info(
                `Number of registered delegates: ${Object.keys(
                    this.walletRepository.allByUsername(),
                ).length.toLocaleString()}`,
            );

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

        const devFunds = await this.blockRepository.getDevFunds();

        for (const devFund of devFunds) {
            const amount: Utils.BigNumber = Utils.BigNumber.make(devFund.amount);

            const devFundWallet = this.walletRepository.findByAddress(devFund.address);
            devFundWallet.increaseBalance(amount);

            const delegateWallet = this.walletRepository.findByUsername(devFund.username);
            delegateWallet.decreaseBalance(amount);
        }
    }

    private async buildSentTransactions(): Promise<void> {
        const transactions = await this.transactionRepository.getSentTransactions();

        for (const transaction of transactions) {
            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
            wallet.setNonce(Utils.BigNumber.make(transaction.nonce));
            wallet.decreaseBalance(
                Utils.BigNumber.make(transaction.amount || Utils.BigNumber.ZERO).plus(transaction.fee),
            );
        }
    }

    private verifyWalletsConsistency(): void {
        const logNegativeBalance = (wallet, type, balance) =>
            this.logger.warning(`Wallet ${wallet.address} has a negative ${type} of '${balance}'`);

        const genesisPublicKeys: Record<string, true> = Managers.configManager
            .get("genesisBlock.transactions")
            .reduce((acc, curr) => Object.assign(acc, { [curr.senderPublicKey]: true }), {});

        for (const wallet of this.walletRepository.allByAddress()) {
            if (
                wallet.getBalance().isLessThan(0) &&
                (wallet.getPublicKey() === undefined || !genesisPublicKeys[wallet.getPublicKey()!])
            ) {
                // Senders of whitelisted transactions that result in a negative balance,
                // also need to be special treated during bootstrap. Therefore, specific
                // senderPublicKey/nonce pairs are allowed to be negative.
                const negativeBalanceExceptions: Record<string, Record<string, string>> = this.configRepository.get(
                    "crypto.exceptions.negativeBalances",
                    {},
                );

                const whitelistedNegativeBalances: Record<string, string> | undefined = wallet.getPublicKey()
                    ? negativeBalanceExceptions[wallet.getPublicKey()!]
                    : undefined;

                if (!whitelistedNegativeBalances) {
                    logNegativeBalance(wallet, "balance", wallet.getBalance());
                    throw new Error("Non-genesis wallet with negative balance");
                }

                const allowedNegativeBalance = wallet
                    .getBalance()
                    .isEqualTo(whitelistedNegativeBalances[wallet.getNonce().toString()]);

                if (!allowedNegativeBalance) {
                    logNegativeBalance(wallet, "balance", wallet.getBalance());
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

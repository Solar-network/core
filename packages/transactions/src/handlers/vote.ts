import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import { VotedForNonBlockProducerError, VotedForTooManyBlockProducersError, ZeroPercentVoteError } from "../errors";
import { RegistrationTransactionHandler } from "./registration";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class VoteTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [RegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["hidden", "hidden.previousVotes", "votes"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.VoteTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<Record<string, number>>(transaction.asset?.votes);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            this.performWalletInitialisation(transaction, wallet);

            wallet.setAttribute("hidden.previousVotes", wallet.getAttribute("votes"));
            wallet.setAttribute("votes", this.convertPublicKeyToUsername(Utils.sortVotes(transaction.asset.votes)));
        }
    }

    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        if (transaction && transaction.internalType === Enums.VoteType.Single) {
            return Managers.configManager.getMilestone(transaction.data.blockHeight).transactionVersions.includes(2);
        }

        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const { activeBlockProducers, transactionVersions } = Managers.configManager.getMilestone();
        const v2 = transactionVersions.includes(2);

        const votes = Object.keys(transaction.data.asset.votes);

        if (votes.length > activeBlockProducers) {
            throw new VotedForTooManyBlockProducersError(activeBlockProducers);
        }

        if (!v2 && Object.values(transaction.data.asset.votes).some((percent) => percent === 0)) {
            throw new ZeroPercentVoteError();
        }

        for (const blockProducer of votes) {
            if (
                (transaction.data.version > 2 && blockProducer.length == 66) ||
                (blockProducer.length != 66 &&
                    (!this.walletRepository.hasByUsername(blockProducer) ||
                        !this.walletRepository.findByUsername(blockProducer).isBlockProducer()))
            ) {
                throw new VotedForNonBlockProducerError(blockProducer);
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async emitEvents(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const wallet = this.walletRepository.findByAddress(transaction.data.senderId);
        this.events.dispatch(AppEnums.WalletEvent.Vote, {
            votes: transaction.data.asset?.votes,
            previousVotes: Object.fromEntries(wallet.getAttribute("hidden.previousVotes").entries()),
            transaction: transaction.data,
            wallet: wallet.getBasicWallet(),
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderId)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            throw new Contracts.Pool.PoolError(
                `${transaction.data.senderId} already has a vote transaction in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.assert.defined<Record<string, number>>(transaction.data.asset?.votes);

        AppUtils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });

        senderWallet.setAttribute("hidden.previousVotes", senderWallet.getAttribute("votes"));

        senderWallet.setAttribute(
            "votes",
            this.convertPublicKeyToUsername(Utils.sortVotes(transaction.data.asset.votes)),
        );
        senderWallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
        senderWallet.setAttribute("votes", senderWallet.getAttribute("hidden.previousVotes"));
        senderWallet.setAttribute("hidden.previousVotes", await this.getPreviousVotes(transaction));
        senderWallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    private async getPreviousVotes(transaction: Interfaces.ITransaction): Promise<Map<string, number>> {
        const previousTransaction: Interfaces.ITransactionData | undefined =
            await this.transactionRepository.getPreviousSentTransactionOfType(transaction.data, 1);
        return this.convertPublicKeyToUsername(previousTransaction?.asset?.votes);
    }

    private convertPublicKeyToUsername(assetVotes: Interfaces.IVoteAsset | undefined): Map<string, number> {
        const votes: Map<string, number> = new Map();
        for (let [name, percent] of Object.entries(assetVotes ?? {})) {
            if (name.length === 66) {
                name = this.walletRepository.findByPublicKey(name).getAttribute("username");
            }

            if (percent > 0) {
                votes.set(name, percent);
            }
        }
        return votes;
    }
}

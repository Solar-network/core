import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import {
    AlreadyVotedForSameDelegatesError,
    NoVoteError,
    VotedForNonDelegateError,
    VotedForTooManyDelegatesError,
    ZeroPercentVoteError,
} from "../errors";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";
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
        return [DelegateRegistrationTransactionHandler];
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
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
                this.walletRepository.index(wallet);
            }

            wallet.setAttribute("hidden.previousVotes", wallet.getAttribute("votes"));
            wallet.setAttribute("votes", Utils.sortVotes(this.convertPublicKeyToUsername(transaction.asset.votes)));
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

        const { activeDelegates, transactionVersions } = Managers.configManager.getMilestone();
        const v2 = transactionVersions.includes(2);

        const votes = Object.keys(transaction.data.asset.votes);

        if (votes.length > activeDelegates) {
            throw new VotedForTooManyDelegatesError(activeDelegates);
        }

        if (!v2 && Object.values(transaction.data.asset.votes).some((percent) => percent === 0)) {
            throw new ZeroPercentVoteError();
        }

        if (AppUtils.isEqual(transaction.data.asset.votes, wallet.getAttribute("votes"))) {
            if (Object.keys(transaction.data.asset.votes).length === 0) {
                throw new NoVoteError();
            }
            if (!v2) {
                throw new AlreadyVotedForSameDelegatesError();
            }
        }

        for (const delegate of votes) {
            if (
                (transaction.data.version > 2 && delegate.length == 66) ||
                (delegate.length != 66 && !this.walletRepository.hasByUsername(delegate))
            ) {
                throw new VotedForNonDelegateError(delegate);
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async emitEvents(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const wallet = this.walletRepository.findByAddress(transaction.data.senderId);
        this.events.dispatch(AppEnums.VoteEvent.Vote, {
            votes: transaction.data.asset?.votes,
            previousVotes: wallet.getAttribute("hidden.previousVotes"),
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
            Utils.sortVotes(this.convertPublicKeyToUsername(transaction.data.asset.votes)),
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

    private async getPreviousVotes(transaction: Interfaces.ITransaction): Promise<Interfaces.IVoteAsset> {
        const criteria = {
            blockHeight: { to: transaction.data.blockHeight! - 1 },
            senderId: transaction.data.senderId,
            type: "vote",
        };

        const { results } = await this.transactionHistoryService.listByCriteria(
            criteria,
            [
                { property: "blockHeight", direction: "desc" },
                { property: "sequence", direction: "desc" },
            ],
            { offset: 1, limit: 1 },
            false,
        );

        return this.convertPublicKeyToUsername(results[0]?.asset?.votes ?? {});
    }

    private convertPublicKeyToUsername(assetVotes: Interfaces.IVoteAsset): Interfaces.IVoteAsset {
        const votes: Interfaces.IVoteAsset = {};
        for (let [name, percent] of Object.entries(assetVotes)) {
            if (name.length === 66) {
                name = this.walletRepository.findByPublicKey(name).getAttribute("delegate.username");
            }

            if (percent > 0) {
                votes[name] = percent;
            }
        }
        return votes;
    }
}

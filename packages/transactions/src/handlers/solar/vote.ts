import { Enums, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import {
    AlreadyVotedForSameDelegatesError,
    NoVoteError,
    VotedForNonDelegateError,
    VotedForResignedDelegateError,
    VotedForTooManyDelegatesError,
} from "../../errors";
import { DelegateRegistrationTransactionHandler } from "../core/delegate-registration";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class VoteTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["votes"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Solar.VoteTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<Record<string, number>>(transaction.asset?.votes);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey() === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey);
                this.walletRepository.index(wallet);
            }

            wallet.setAttribute("votes", Utils.sortVotes(transaction.asset.votes));
        }
    }

    public async isActivated(): Promise<boolean> {
        return !Managers.configManager.getMilestone().legacyVote;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const { activeDelegates, canVoteForResignedDelegates } = Managers.configManager.getMilestone();
        const votes = Object.keys(transaction.data.asset.votes);

        if (votes.length > activeDelegates) {
            throw new VotedForTooManyDelegatesError(activeDelegates);
        }

        if (AppUtils.isEqual(transaction.data.asset.votes, wallet.getAttribute("votes"))) {
            if (Object.keys(transaction.data.asset.votes).length === 0) {
                throw new NoVoteError();
            }
            throw new AlreadyVotedForSameDelegatesError();
        }

        for (const delegate of votes) {
            if (!this.walletRepository.hasByUsername(delegate)) {
                throw new VotedForNonDelegateError(delegate);
            }

            if (!canVoteForResignedDelegates) {
                if (this.walletRepository.findByUsername(delegate).hasAttribute("delegate.resigned")) {
                    throw new VotedForResignedDelegateError(delegate);
                }
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async emitEvents(
        transaction: Interfaces.ITransaction,
        emitter: Contracts.Kernel.EventDispatcher,
    ): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const wallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const previousVotes = await this.getPreviousVotes(transaction);
        emitter.dispatch(AppEnums.VoteEvent.Vote, {
            votes: transaction.data.asset?.votes,
            previousVotes,
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
        senderWallet.setAttribute("votes", Utils.sortVotes(transaction.data.asset?.votes));
        senderWallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const sender: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const previousVotes = await this.getPreviousVotes(transaction);

        AppUtils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.setAttribute("votes", previousVotes);
        sender.updateVoteBalances();
        AppUtils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    private async getPreviousVotes(transaction: Interfaces.ITransaction): Promise<object> {
        const heightAndSender = {
            blockHeight: { to: transaction.data.blockHeight! - 1 },
            senderId: transaction.data.senderId,
        };

        const criteria = {
            ...heightAndSender,
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        const legacyCriteria = {
            ...heightAndSender,
            typeGroup: Enums.TransactionTypeGroup.Core,
            type: Enums.TransactionType.Core.Vote,
        };

        const { results } = await this.transactionHistoryService.listByCriteria(
            [criteria, legacyCriteria],
            [{ property: "blockHeight", direction: "desc" }],
            { offset: 0, limit: 1 },
        );

        if (results[0] && results[0].asset) {
            if (!Array.isArray(results[0].asset.votes)) {
                return results[0].asset.votes!;
            }

            const previousVote = (results[0].asset.votes as string[]).pop();
            if (previousVote && previousVote.startsWith("+")) {
                let delegateVote: string = previousVote.slice(1);
                if (delegateVote.length === 66) {
                    delegateVote = this.walletRepository
                        .findByPublicKey(delegateVote)
                        .getAttribute("delegate.username");
                }
                return { [delegateVote]: 100 };
            }
        }

        return {};
    }
}

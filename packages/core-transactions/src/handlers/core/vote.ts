import { Container, Contracts, Enums as AppEnums, Utils } from "@solar-network/core-kernel";
import { Identities, Interfaces, Managers, Transactions } from "@solar-network/crypto";

import {
    AlreadyVotedError,
    NoVoteError,
    UnvoteMismatchError,
    VotedForNonDelegateError,
    VotedForResignedDelegateError,
} from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

@Container.injectable()
export class LegacyVoteTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["votes"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.LegacyVoteTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            Utils.assert.defined<string>(transaction.senderPublicKey);
            Utils.assert.defined<string[]>(transaction.asset?.votes);

            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);

            let walletVote: { [vote: string]: number } = wallet.getAttribute("votes");

            for (const vote of transaction.asset.votes) {
                let delegateVote: string = vote.slice(1);
                const votingFor: string = Object.keys(walletVote)[0];

                if (delegateVote.length === 66) {
                    const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(delegateVote);
                    delegateVote = delegateWallet.getAttribute("delegate.username");
                }

                if (vote.startsWith("+")) {
                    if (votingFor) {
                        throw new AlreadyVotedError();
                    }

                    walletVote = { [delegateVote]: 100 };
                } else {
                    if (votingFor === undefined) {
                        throw new NoVoteError();
                    } else if (votingFor !== delegateVote) {
                        throw new UnvoteMismatchError();
                    }

                    walletVote = {};
                }
            }

            wallet.changeVotes(walletVote);
        }
    }

    public async isActivated(): Promise<boolean> {
        return Managers.configManager.getMilestone().legacyVote;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        let walletVote: string | undefined;
        if (wallet.hasVoted()) {
            walletVote = Object.keys(wallet.getAttribute("votes"))[0];
        }

        for (const vote of transaction.data.asset.votes) {
            let delegateVote: string = vote.slice(1);
            let delegateWallet: Contracts.State.Wallet;

            if (delegateVote.length === 66) {
                delegateWallet = this.walletRepository.findByPublicKey(delegateVote);

                if (!delegateWallet.isDelegate()) {
                    throw new VotedForNonDelegateError();
                }

                delegateVote = delegateWallet.getAttribute("delegate.username");
            } else {
                if (!this.walletRepository.hasByUsername(delegateVote)) {
                    throw new VotedForNonDelegateError(delegateVote);
                }
                delegateWallet = this.walletRepository.findByUsername(delegateVote);
            }

            if (vote.startsWith("+")) {
                if (walletVote) {
                    throw new AlreadyVotedError();
                }

                if (delegateWallet.hasAttribute("delegate.resigned")) {
                    throw new VotedForResignedDelegateError(delegateVote);
                }

                walletVote = delegateVote;
            } else {
                if (!walletVote) {
                    throw new NoVoteError();
                } else if (walletVote !== delegateVote) {
                    throw new UnvoteMismatchError();
                }

                walletVote = undefined;
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        for (let vote of transaction.data.asset.votes) {
            const delegateVote: string = vote.slice(1);
            if (delegateVote.length === 66) {
                const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(delegateVote);
                vote = vote[0] + Object.keys(delegateWallet.getAttribute("delegate.username"))[0];
            }

            emitter.dispatch(vote.startsWith("+") ? AppEnums.VoteEvent.Vote : AppEnums.VoteEvent.Unvote, {
                delegate: vote,
                transaction: transaction.data,
            });
        }
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderPublicKey)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            throw new Contracts.TransactionPool.PoolError(
                `${Identities.Address.fromPublicKey(
                    transaction.data.senderPublicKey,
                )} already has a vote transaction in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        let walletVote!: { [vote: string]: number };

        for (const vote of transaction.data.asset.votes) {
            let delegateWallet: Contracts.State.Wallet;
            let delegateVote: string = vote.slice(1);
            if (delegateVote.length === 66) {
                delegateWallet = this.walletRepository.findByPublicKey(delegateVote);
                delegateVote = delegateWallet.getAttribute("delegate.username");
            } else {
                delegateWallet = this.walletRepository.findByUsername(delegateVote);
            }

            if (vote.startsWith("+")) {
                walletVote = { [delegateVote]: 100 };
            } else {
                walletVote = {};
            }
        }

        Utils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.changeVotes(walletVote);
        sender.updateVoteBalances();
        Utils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const votes = sender.getStateHistory("votes");

        votes.pop()!;
        const previousVotes = votes.at(-1)!;

        Utils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.setAttribute("votes", previousVotes);
        sender.updateVoteBalances();
        Utils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

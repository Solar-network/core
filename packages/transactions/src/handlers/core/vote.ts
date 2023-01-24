import { Enums, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils } from "@solar-network/kernel";

import { AlreadyVotedError, NoVoteError, UnvoteMismatchError, VotedForNonDelegateError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

@Container.injectable()
export class LegacyVoteTransactionHandler extends TransactionHandler {
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
        return Transactions.Core.LegacyVoteTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            Utils.assert.defined<string>(transaction.senderId);
            Utils.assert.defined<string[]>(transaction.asset?.votes);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey() === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey);
                this.walletRepository.index(wallet);
            }

            const walletVote: Map<string, number> = wallet.getAttribute("votes");

            for (const vote of transaction.asset.votes) {
                let delegateVote: string = vote.slice(1);
                const votingFor: string = walletVote.keys().next().value;

                if (delegateVote.length === 66) {
                    delegateVote = this.walletRepository
                        .findByPublicKey(delegateVote)
                        .getAttribute("delegate.username");
                }

                walletVote.clear();
                if (vote.startsWith("+")) {
                    if (votingFor) {
                        throw new AlreadyVotedError();
                    }

                    walletVote.set(delegateVote, 100);
                } else {
                    if (votingFor === undefined) {
                        throw new NoVoteError();
                    } else if (votingFor !== delegateVote) {
                        throw new UnvoteMismatchError();
                    }
                }
            }

            wallet.setAttribute("votes", walletVote);
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
            walletVote = wallet.getAttribute("votes").keys().next().value;
        }

        for (const vote of transaction.data.asset.votes) {
            let delegateVote: string = vote.slice(1);

            if (delegateVote.length === 66) {
                const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(delegateVote);

                if (!delegateWallet.isDelegate()) {
                    throw new VotedForNonDelegateError();
                }

                delegateVote = delegateWallet.getAttribute("delegate.username");
            } else {
                if (!this.walletRepository.hasByUsername(delegateVote)) {
                    throw new VotedForNonDelegateError(delegateVote);
                }
            }

            if (vote.startsWith("+")) {
                if (walletVote) {
                    throw new AlreadyVotedError();
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
        let previousVote!: string;
        let vote!: string;
        for (let voteAsset of transaction.data.asset.votes) {
            const delegateVote: string = voteAsset.slice(1);
            if (delegateVote.length === 66) {
                voteAsset =
                    voteAsset[0] +
                    Object.keys(
                        this.walletRepository.findByPublicKey(delegateVote).getAttribute("delegate.username"),
                    )[0];
            }

            if (voteAsset.startsWith("-")) {
                previousVote = voteAsset.slice(1);
            } else {
                vote = voteAsset.slice(1);
            }
        }

        emitter.dispatch(AppEnums.VoteEvent.Vote, {
            vote,
            previousVote,
            transaction: transaction.data,
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        Utils.assert.defined<string>(transaction.data.senderId);

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

        Utils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        const walletVote: Map<string, number> = new Map();

        for (const vote of transaction.data.asset.votes) {
            let delegateVote: string = vote.slice(1);
            if (delegateVote.length === 66) {
                delegateVote = this.walletRepository.findByPublicKey(delegateVote).getAttribute("delegate.username");
            }

            walletVote.clear();
            if (vote.startsWith("+")) {
                walletVote.set(delegateVote, 100);
            }
        }

        Utils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
        senderWallet.setAttribute("votes", walletVote);
        senderWallet.updateVoteBalances();
        Utils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        const previousVotes: Map<string, number> = new Map();

        Utils.assert.defined<Interfaces.ITransactionAsset>(transaction.data.asset?.votes);

        for (const vote of transaction.data.asset.votes.slice().reverse()) {
            let delegateVote: string = vote.slice(1);
            if (delegateVote.length === 66) {
                delegateVote = this.walletRepository.findByPublicKey(delegateVote).getAttribute("delegate.username");
            }

            previousVotes.clear();
            if (vote.startsWith("-")) {
                previousVotes.set(delegateVote, 100);
            }
        }

        Utils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
        senderWallet.setAttribute("votes", previousVotes);
        senderWallet.updateVoteBalances();
        Utils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

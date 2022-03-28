import { Container, Contracts, Enums as AppEnums, Utils } from "@solar-network/core-kernel";
import { Interfaces, Managers, Transactions } from "@solar-network/crypto";

import {
    AlreadyVotedError,
    NoVoteError,
    SwitchVoteDisabledError,
    UnvoteMismatchError,
    VotedForNonDelegateError,
    VotedForResignedDelegateError,
} from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

// todo: revisit the implementation, container usage and arguments after core-database rework
// todo: replace unnecessary function arguments with dependency injection to avoid passing around references
@Container.injectable()
export class VoteTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["vote"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.One.VoteTransaction;
    }

    public async bootstrap(): Promise<void> {}

    public async isActivated(): Promise<boolean> {
        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        if (transaction.data.asset.votes.length > 1 && !Managers.configManager.getMilestone().aip37) {
            throw new SwitchVoteDisabledError();
        }

        let walletVote: string | undefined;
        if (wallet.hasAttribute("vote")) {
            walletVote = wallet.getAttribute("vote");
        }

        for (const vote of transaction.data.asset.votes) {
            let delegateVote: string = vote.slice(1);
            let delegateWallet: Contracts.State.Wallet;

            if (delegateVote.length === 66) {
                delegateWallet = this.walletRepository.findByPublicKey(delegateVote);
            } else {
                delegateWallet = this.walletRepository.findByUsername(delegateVote);
                delegateVote = delegateWallet.getPublicKey()!;
            }

            if (vote.startsWith("+")) {
                if (walletVote) {
                    throw new AlreadyVotedError();
                }

                if (delegateWallet.hasAttribute("delegate.resigned")) {
                    throw new VotedForResignedDelegateError(vote);
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

            if (!delegateWallet.isDelegate()) {
                throw new VotedForNonDelegateError(vote);
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        for (let vote of transaction.data.asset.votes) {
            const delegateVote: string = vote.slice(1);
            if (delegateVote.length !== 66) {
                const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegateVote);
                vote = vote[0] + delegateWallet.getPublicKey();
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
                `Sender ${transaction.data.senderPublicKey} already has a vote transaction in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        for (const vote of transaction.data.asset.votes) {
            if (vote.startsWith("+")) {
                let delegateVote: string = vote.slice(1);
                if (delegateVote.length !== 66) {
                    const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegateVote);
                    delegateVote = delegateWallet.getPublicKey()!;
                }
                sender.setAttribute("vote", delegateVote);
            } else {
                sender.forgetAttribute("vote");
            }
        }
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        Utils.assert.defined<Interfaces.ITransactionAsset>(transaction.data.asset?.votes);

        for (const vote of transaction.data.asset.votes.slice().reverse()) {
            if (vote.startsWith("+")) {
                sender.forgetAttribute("vote");
            } else {
                let delegateVote: string = vote.slice(1);
                if (delegateVote.length !== 66) {
                    const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegateVote);
                    delegateVote = delegateWallet.getPublicKey()!;
                }
                sender.setAttribute("vote", delegateVote);
            }
        }
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

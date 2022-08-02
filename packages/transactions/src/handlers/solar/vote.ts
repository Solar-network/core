import { Identities, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils } from "@solar-network/kernel";

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
            Utils.assert.defined<string>(transaction.senderPublicKey);
            Utils.assert.defined<string[]>(transaction.asset?.votes);

            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);

            wallet.changeVotes(transaction.asset.votes, transaction);
        }
    }

    public async isActivated(): Promise<boolean> {
        return !Managers.configManager.getMilestone().legacyVote;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        const { activeDelegates } = Managers.configManager.getMilestone();
        const votes = Object.keys(transaction.data.asset.votes);

        if (votes.length > activeDelegates) {
            throw new VotedForTooManyDelegatesError(activeDelegates);
        }

        if (Utils.isEqual(transaction.data.asset.votes, wallet.getCurrentStateHistory("votes").value)) {
            if (Object.keys(transaction.data.asset.votes).length === 0) {
                throw new NoVoteError();
            }
            throw new AlreadyVotedForSameDelegatesError();
        }

        for (const delegate of votes) {
            if (!this.walletRepository.hasByUsername(delegate)) {
                throw new VotedForNonDelegateError(delegate);
            }

            const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegate);
            if (delegateWallet.hasAttribute("delegate.resigned")) {
                throw new VotedForResignedDelegateError(delegate);
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.EventDispatcher): void {
        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        const wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const previousVotes = wallet
            .getStateHistory("votes")
            .filter(
                (state) =>
                    (!state.transaction ||
                        (state.transaction && state.transaction.height <= transaction.data.blockHeight!)) &&
                    Utils.isNotEqual(transaction.data.asset?.votes, state.value),
            )
            .reverse()[0].value;
        emitter.dispatch(AppEnums.VoteEvent.Vote, {
            votes: transaction.data.asset?.votes,
            previousVotes,
            transaction: transaction.data,
            wallet
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderPublicKey)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            throw new Contracts.Pool.PoolError(
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

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        Utils.assert.defined<string[]>(transaction.data.asset?.votes);

        Utils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
        senderWallet.changeVotes(transaction.data.asset?.votes, transaction.data);
        senderWallet.updateVoteBalances();
        Utils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        sender.removeCurrentStateHistory("votes");
        const previousVotes = sender.getCurrentStateHistory("votes").value;

        Utils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.setAttribute("votes", previousVotes);
        sender.updateVoteBalances();
        Utils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

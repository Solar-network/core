import { Container, Contracts, Enums as AppEnums, Utils } from "@solar-network/core-kernel";
import { Interfaces, Managers, Transactions } from "@solar-network/crypto";

import { VotedForNonDelegateError, VotedForResignedDelegateError } from "../../errors";
import { DelegateRegistrationTransactionHandler } from "../core/delegate-registration";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class VoteTransactionHandler extends TransactionHandler {
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

            wallet.changeVotes(transaction.asset.votes);
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

        for (const delegate of Object.keys(transaction.data.asset.votes)) {
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

        emitter.dispatch(AppEnums.VoteEvent.Vote, {
            delegates: transaction.data.asset?.votes,
            transaction: transaction.data,
        });
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

        Utils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.changeVotes(transaction.data.asset?.votes);
        sender.updateVoteBalance();
        Utils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const votes = sender.getVotes();

        votes.pop()!;
        const previousVotes = votes.at(-1)!;

        Utils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.setAttribute("votes", previousVotes);
        sender.updateVoteBalance();
        Utils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}

import { Identities, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
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
            AppUtils.assert.defined<string>(transaction.senderPublicKey);
            AppUtils.assert.defined<Record<string, number>>(transaction.asset?.votes);

            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);

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

        const { activeDelegates } = Managers.configManager.getMilestone();
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

            const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegate);
            if (delegateWallet.hasAttribute("delegate.resigned")) {
                throw new VotedForResignedDelegateError(delegate);
            }
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async emitEvents(
        transaction: Interfaces.ITransaction,
        emitter: Contracts.Kernel.EventDispatcher,
    ): Promise<void> {
        AppUtils.assert.defined<string[]>(transaction.data.asset?.votes);

        const wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);
        const previousVotes = await this.getPreviousVotes(transaction);
        emitter.dispatch(AppEnums.VoteEvent.Vote, {
            votes: transaction.data.asset?.votes,
            previousVotes,
            transaction: transaction.data,
            wallet: wallet.getBasicWallet(),
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

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

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        AppUtils.assert.defined<Record<string, number>>(transaction.data.asset?.votes);

        AppUtils.decreaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
        senderWallet.setAttribute("votes", Utils.sortVotes(transaction.data.asset?.votes));
        senderWallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(senderWallet, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

        const sender: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.data.senderPublicKey);

        const previousVotes = await this.getPreviousVotes(transaction);

        AppUtils.decreaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
        sender.setAttribute("votes", previousVotes);
        sender.updateVoteBalances();
        AppUtils.increaseVoteBalances(sender, { updateVoters: true, walletRepository: this.walletRepository });
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    private async getPreviousVotes(transaction: Interfaces.ITransaction): Promise<object> {
        const { results } = await this.transactionHistoryService.listByCriteria(
            {
                blockHeight: { to: transaction.data.blockHeight! - 1 },
                senderPublicKey: transaction.data.senderPublicKey,
                typeGroup: this.getConstructor().typeGroup,
                type: this.getConstructor().type,
            },
            [{ property: "blockHeight", direction: "desc" }],
            { offset: 0, limit: 1 },
        );

        if (results[0] && results[0].asset) {
            return results[0].asset.votes!;
        }

        return {};
    }
}

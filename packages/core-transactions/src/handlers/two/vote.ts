import { Container, Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { Transactions } from "@solar-network/crypto";

import { AlreadyVotedError, NoVoteError, UnvoteMismatchError } from "../../errors";
import { One } from "../index";
import { TransactionHandlerConstructor } from "../transaction";
import { DelegateRegistrationTransactionHandler } from "./delegate-registration";

@Container.injectable()
export class VoteTransactionHandler extends One.VoteTransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [DelegateRegistrationTransactionHandler];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Two.VoteTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderPublicKey);
            AppUtils.assert.defined<string[]>(transaction.asset?.votes);

            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);

            for (const vote of transaction.asset.votes) {
                const hasVoted: boolean = wallet.hasAttribute("vote");

                let delegateVote: string = vote.slice(1);
                if (delegateVote.length !== 66) {
                    const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(delegateVote);
                    delegateVote = delegateWallet.getPublicKey()!;
                }

                if (vote.startsWith("+")) {
                    if (hasVoted) {
                        throw new AlreadyVotedError();
                    }

                    wallet.setAttribute("vote", delegateVote);
                } else {
                    if (!hasVoted) {
                        throw new NoVoteError();
                    } else if (wallet.getAttribute("vote") !== delegateVote) {
                        throw new UnvoteMismatchError();
                    }

                    wallet.forgetAttribute("vote");
                }
            }
        }
    }
}

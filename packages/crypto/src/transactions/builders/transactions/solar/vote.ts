import { ITransactionData } from "../../../../interfaces";
import { sortVotes } from "../../../../utils";
import { Solar } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class VoteBuilder extends TransactionBuilder<VoteBuilder> {
    public constructor() {
        super();

        this.data.type = Solar.VoteTransaction.type;
        this.data.typeGroup = Solar.VoteTransaction.typeGroup;
        this.data.fee = Solar.VoteTransaction.staticFee();
        this.data.asset = { votes: {} };
    }

    public votesAsset(votes: { [vote: string]: number }): VoteBuilder {
        if (Array.isArray(votes)) {
            const voteArray: string[] = votes
                .filter((vote) => !vote.startsWith("-"))
                .map((vote) => (vote.startsWith("+") ? vote.slice(1) : vote));
            const voteObject: Record<string, number> = {};

            if (voteArray.length > 0) {
                const weight: number = Math.trunc(10000 / voteArray.length);
                let remainder: number = 10000;

                for (const vote of voteArray) {
                    voteObject[vote] = weight / 100;
                    remainder -= weight;
                }

                for (let i = 0; i < remainder; i++) {
                    const key = Object.keys(voteObject)[i];
                    voteObject[key] = Math.round((voteObject[key] + 0.01) * 100) / 100;
                }
            }

            votes = voteObject;
        }

        if (votes) {
            const numberOfVotes: number = Object.keys(votes).length;

            if (numberOfVotes > 0) {
                votes = sortVotes(votes);
            }
        }

        if (this.data.asset && this.data.asset.votes) {
            this.data.asset.votes = votes;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): VoteBuilder {
        return this;
    }
}

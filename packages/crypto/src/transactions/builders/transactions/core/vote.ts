import { ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class VoteBuilder extends TransactionBuilder<VoteBuilder> {
    public constructor() {
        super();

        this.data.type = Core.LegacyVoteTransaction.type;
        this.data.typeGroup = Core.LegacyVoteTransaction.typeGroup;
        this.data.fee = Core.LegacyVoteTransaction.staticFee();
        this.data.asset = { votes: [] };
    }

    public votesAsset(votes: string[]): VoteBuilder {
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

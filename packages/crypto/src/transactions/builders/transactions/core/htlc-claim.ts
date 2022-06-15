import { IHtlcClaimAsset, ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class HtlcClaimBuilder extends TransactionBuilder<HtlcClaimBuilder> {
    public constructor() {
        super();

        this.data.type = Core.HtlcClaimTransaction.type;
        this.data.typeGroup = Core.HtlcClaimTransaction.typeGroup;
        this.data.fee = Core.HtlcClaimTransaction.staticFee();
        this.data.asset = {};
    }

    public htlcClaimAsset(claimAsset: IHtlcClaimAsset): HtlcClaimBuilder {
        this.data.asset = {
            claim: claimAsset,
        };

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): HtlcClaimBuilder {
        return this;
    }
}

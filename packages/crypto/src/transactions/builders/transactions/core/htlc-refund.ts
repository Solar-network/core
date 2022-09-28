import { IHtlcRefundAsset, ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class HtlcRefundBuilder extends TransactionBuilder<HtlcRefundBuilder> {
    public constructor() {
        super();

        this.data.type = Core.HtlcRefundTransaction.type;
        this.data.typeGroup = Core.HtlcRefundTransaction.typeGroup;
        this.data.asset = {};
    }

    public refundAsset(refundAsset: IHtlcRefundAsset): HtlcRefundBuilder {
        this.data.asset = {
            refund: refundAsset,
        };

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): HtlcRefundBuilder {
        return this;
    }
}

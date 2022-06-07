import { ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Solar } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class BurnBuilder extends TransactionBuilder<BurnBuilder> {
    public constructor() {
        super();

        this.data.typeGroup = Solar.BurnTransaction.typeGroup;
        this.data.type = Solar.BurnTransaction.type;
        this.data.fee = Solar.BurnTransaction.staticFee();
        this.data.amount = BigNumber.ZERO;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;

        super.validate(struct);
        return struct;
    }

    protected instance(): BurnBuilder {
        return this;
    }
}

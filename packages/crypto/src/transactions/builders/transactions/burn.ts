import { ITransactionData } from "../../../interfaces";
import { BigNumber } from "../../../utils";
import { Solar } from "../../types";
import { TransactionBuilder } from "./transaction";

export class BurnTransactionBuilder extends TransactionBuilder<BurnTransactionBuilder> {
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
        return struct;
    }

    protected instance(): BurnTransactionBuilder {
        return this;
    }
}

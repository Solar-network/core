import { ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class DelegateResignationBuilder extends TransactionBuilder<DelegateResignationBuilder> {
    public constructor() {
        super();

        this.data.type = Core.DelegateResignationTransaction.type;
        this.data.typeGroup = Core.DelegateResignationTransaction.typeGroup;
        this.data.fee = Core.DelegateResignationTransaction.staticFee();
        this.data.amount = BigNumber.ZERO;
        this.data.senderPublicKey = undefined;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;

        super.validate(struct);
        return struct;
    }

    protected instance(): DelegateResignationBuilder {
        return this;
    }
}

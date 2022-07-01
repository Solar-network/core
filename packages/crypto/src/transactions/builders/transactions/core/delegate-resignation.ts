import { ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class DelegateResignationBuilder extends TransactionBuilder<DelegateResignationBuilder> {
    public constructor() {
        super();

        this.data.type = Core.DelegateResignationTransaction.type;
        this.data.typeGroup = Core.DelegateResignationTransaction.typeGroup;
        this.data.fee = Core.DelegateResignationTransaction.staticFee();
        this.data.asset = {};
    }

    public resignationTypeAsset(resignationTypeAsset: number): DelegateResignationBuilder {
        this.data.asset = {
            resignationType: resignationTypeAsset,
        };

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): DelegateResignationBuilder {
        return this;
    }
}

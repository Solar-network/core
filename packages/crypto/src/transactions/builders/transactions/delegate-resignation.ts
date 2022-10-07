import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class DelegateResignationBuilder extends TransactionBuilder<DelegateResignationBuilder> {
    public constructor() {
        super();

        this.data.asset = { resignation: {} } as ITransactionAsset;
        this.data.type = "delegateResignation";
    }

    public typeAsset(typeAsset: number): DelegateResignationBuilder {
        if (this.data.asset && this.data.asset.resignation) {
            this.data.asset.resignation.type = typeAsset;
        }

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

import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class ResignationBuilder extends TransactionBuilder<ResignationBuilder> {
    public constructor() {
        super();

        this.data.asset = { resignation: {} } as ITransactionAsset;
        this.data.type = "resignation";
    }

    public typeAsset(typeAsset: number): ResignationBuilder {
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

    protected instance(): ResignationBuilder {
        return this;
    }
}

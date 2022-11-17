import { ITransactionData } from "../../../interfaces";
import { BigNumber } from "../../../utils";
import { TransactionBuilder } from "./transaction";

export class BurnBuilder extends TransactionBuilder<BurnBuilder> {
    public constructor() {
        super();

        this.data.asset = { burn: { amount: BigNumber.ZERO } };
        this.data.type = "burn";
    }

    public burnAsset(amount: string): BurnBuilder {
        if (this.data.asset && this.data.asset.burn) {
            this.data.asset.burn = { amount: BigNumber.make(amount) };
        }

        return this;
    }

    public amount(amount: string): BurnBuilder {
        return this.burnAsset(amount);
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();

        super.validate(struct);
        return struct;
    }

    protected instance(): BurnBuilder {
        return this;
    }
}

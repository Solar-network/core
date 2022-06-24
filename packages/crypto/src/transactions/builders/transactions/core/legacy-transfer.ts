import { ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class LegacyTransferBuilder extends TransactionBuilder<LegacyTransferBuilder> {
    public constructor() {
        super();

        this.data.type = Core.LegacyTransferTransaction.type;
        this.data.typeGroup = Core.LegacyTransferTransaction.typeGroup;
        this.data.fee = Core.LegacyTransferTransaction.staticFee();
        this.data.amount = BigNumber.ZERO;
        this.data.recipientId = undefined;
        this.data.expiration = 0;
    }

    public expiration(expiration: number): LegacyTransferBuilder {
        this.data.expiration = expiration;

        return this.instance();
    }

    public amount(amount: string): LegacyTransferBuilder {
        this.data.amount = BigNumber.make(amount);

        return this.instance();
    }

    public recipientId(recipientId: string): LegacyTransferBuilder {
        this.data.recipientId = recipientId;

        return this.instance();
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;
        struct.recipientId = this.data.recipientId;
        struct.asset = this.data.asset;
        struct.expiration = this.data.expiration;

        super.validate(struct);
        return struct;
    }

    protected instance(): LegacyTransferBuilder {
        return this;
    }
}

import { MaximumPaymentCountExceededError } from "../../../../errors";
import { ITransactionData } from "../../../../interfaces";
import { configManager } from "../../../../managers";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class MultiPaymentBuilder extends TransactionBuilder<MultiPaymentBuilder> {
    public constructor() {
        super();

        this.data.type = Core.MultiPaymentTransaction.type;
        this.data.typeGroup = Core.MultiPaymentTransaction.typeGroup;
        this.data.fee = Core.MultiPaymentTransaction.staticFee();
        this.data.vendorField = undefined;
        this.data.asset = {
            payments: [],
        };
    }

    public addPayment(recipientId: string, amount: string): MultiPaymentBuilder {
        if (this.data.asset && this.data.asset.payments) {
            const limit: number = configManager.getMilestone().multiPaymentLimit || 256;
            if (this.data.asset.payments.length >= limit) {
                throw new MaximumPaymentCountExceededError(limit);
            }

            this.data.asset.payments.push({
                amount: BigNumber.make(amount),
                recipientId,
            });
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.senderPublicKey = this.data.senderPublicKey;
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): MultiPaymentBuilder {
        return this;
    }
}

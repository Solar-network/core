import { MaximumTransferCountExceededError } from "../../../../errors";
import { ITransactionData } from "../../../../interfaces";
import { configManager } from "../../../../managers";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class TransferBuilder extends TransactionBuilder<TransferBuilder> {
    public constructor() {
        super();

        this.data.type = Core.TransferTransaction.type;
        this.data.typeGroup = Core.TransferTransaction.typeGroup;
        this.data.fee = Core.TransferTransaction.staticFee();
        this.data.memo = undefined;
        this.data.asset = {
            recipients: [],
        };
    }

    public amount(amountString: string): TransferBuilder {
        const amount = BigNumber.make(amountString);
        if (this.data.asset && this.data.asset.recipients && this.data.asset.recipients.length > 0) {
            this.data.asset = { recipients: [{ recipientId: this.data.asset.recipients[0].recipientId, amount }] };
        } else {
            this.data.asset = { recipients: [{ recipientId: "", amount }] };
        }
        return this;
    }

    public recipientId(recipientId: string): TransferBuilder {
        if (this.data.asset && this.data.asset.recipients && this.data.asset.recipients.length > 0) {
            this.data.asset = { recipients: [{ recipientId, amount: this.data.asset.recipients[0].amount }] };
        } else {
            this.data.asset = { recipients: [{ recipientId, amount: BigNumber.ZERO }] };
        }
        return this;
    }

    public addPayment(recipientId: string, amount: string): TransferBuilder {
        return this.addTransfer(recipientId, amount);
    }

    public addTransfer(recipientId: string, amount: string): TransferBuilder {
        if (this.data.asset && this.data.asset.recipients) {
            const limit: number = configManager.getMilestone().transfer.maximumRecipients;
            if (this.data.asset.recipients.length >= limit) {
                throw new MaximumTransferCountExceededError(limit);
            }

            this.data.asset.recipients.push({
                amount: BigNumber.make(amount),
                recipientId,
            });
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): TransferBuilder {
        return this;
    }
}

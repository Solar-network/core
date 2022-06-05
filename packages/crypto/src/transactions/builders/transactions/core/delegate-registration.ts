import { ITransactionAsset, ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class DelegateRegistrationBuilder extends TransactionBuilder<DelegateRegistrationBuilder> {
    public constructor() {
        super();

        this.data.type = Core.DelegateRegistrationTransaction.type;
        this.data.typeGroup = Core.DelegateRegistrationTransaction.typeGroup;
        this.data.fee = Core.DelegateRegistrationTransaction.staticFee();
        this.data.amount = BigNumber.ZERO;
        this.data.recipientId = undefined;
        this.data.senderPublicKey = undefined;
        this.data.asset = { delegate: {} } as ITransactionAsset;
    }

    public usernameAsset(username: string): DelegateRegistrationBuilder {
        if (this.data.asset && this.data.asset.delegate) {
            this.data.asset.delegate.username = username;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;
        struct.recipientId = this.data.recipientId;
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): DelegateRegistrationBuilder {
        return this;
    }
}

import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class DelegateRegistrationBuilder extends TransactionBuilder<DelegateRegistrationBuilder> {
    public constructor() {
        super();

        this.data.asset = { registration: {} } as ITransactionAsset;
        this.data.type = "delegateRegistration";
    }

    public usernameAsset(username: string): DelegateRegistrationBuilder {
        if (this.data.asset && this.data.asset.registration) {
            this.data.asset.registration.username = username;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): DelegateRegistrationBuilder {
        return this;
    }
}

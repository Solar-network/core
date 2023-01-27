import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class RegistrationBuilder extends TransactionBuilder<RegistrationBuilder> {
    public constructor() {
        super();

        this.data.asset = { registration: {} } as ITransactionAsset;
        this.data.type = "registration";
    }

    public usernameAsset(username: string): RegistrationBuilder {
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

    protected instance(): RegistrationBuilder {
        return this;
    }
}

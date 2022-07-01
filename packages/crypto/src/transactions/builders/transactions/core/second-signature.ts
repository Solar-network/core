import { Keys } from "../../../../identities";
import { ITransactionAsset, ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class SecondSignatureBuilder extends TransactionBuilder<SecondSignatureBuilder> {
    public constructor() {
        super();

        this.data.type = Core.SecondSignatureRegistrationTransaction.type;
        this.data.typeGroup = Core.SecondSignatureRegistrationTransaction.typeGroup;
        this.data.fee = Core.SecondSignatureRegistrationTransaction.staticFee();
        this.data.asset = { signature: {} } as ITransactionAsset;
    }

    public signatureAsset(secondPassphrase: string): SecondSignatureBuilder {
        if (this.data.asset && this.data.asset.signature) {
            this.data.asset.signature.publicKey = Keys.fromPassphrase(secondPassphrase).publicKey;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): SecondSignatureBuilder {
        return this;
    }
}

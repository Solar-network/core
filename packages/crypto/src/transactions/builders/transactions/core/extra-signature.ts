import { Keys } from "../../../../identities";
import { ITransactionAsset, ITransactionData } from "../../../../interfaces";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class ExtraSignatureBuilder extends TransactionBuilder<ExtraSignatureBuilder> {
    public constructor() {
        super();

        this.data.type = Core.ExtraSignatureRegistrationTransaction.type;
        this.data.typeGroup = Core.ExtraSignatureRegistrationTransaction.typeGroup;
        this.data.fee = Core.ExtraSignatureRegistrationTransaction.staticFee();
        this.data.asset = { signature: {} } as ITransactionAsset;
    }

    public signatureAsset(extraMnemonic: string): ExtraSignatureBuilder {
        if (this.data.asset && this.data.asset.signature) {
            this.data.asset.signature.publicKey = Keys.fromMnemonic(extraMnemonic).publicKey.secp256k1;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): ExtraSignatureBuilder {
        return this;
    }
}

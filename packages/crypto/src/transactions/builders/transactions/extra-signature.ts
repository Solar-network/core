import { Keys } from "../../../identities";
import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class ExtraSignatureBuilder extends TransactionBuilder<ExtraSignatureBuilder> {
    public constructor() {
        super();

        this.data.asset = { signature: {} } as ITransactionAsset;
        this.data.type = "extraSignature";
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

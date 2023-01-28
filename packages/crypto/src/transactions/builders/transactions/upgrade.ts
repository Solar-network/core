import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class UpgradeBuilder extends TransactionBuilder<UpgradeBuilder> {
    public constructor() {
        super();

        this.data.asset = { blockProducer: {} } as ITransactionAsset;
        this.data.type = "upgrade";
    }

    public blockProducerAsset(asset: { publicKey: string; signature: string }): UpgradeBuilder {
        const { publicKey, signature } = asset ?? {};

        if (this.data.asset && this.data.asset.blockProducer) {
            this.data.asset.blockProducer = {
                publicKey,
                signature,
            };
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): UpgradeBuilder {
        return this;
    }
}

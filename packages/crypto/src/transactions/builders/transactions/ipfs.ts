import { ITransactionAsset, ITransactionData } from "../../../interfaces";
import { TransactionBuilder } from "./transaction";

export class IPFSBuilder extends TransactionBuilder<IPFSBuilder> {
    public constructor() {
        super();

        this.data.asset = { ipfs: {} } as ITransactionAsset;
        this.data.type = "ipfs";
    }

    public hashAsset(hash: string): IPFSBuilder {
        if (this.data.asset && this.data.asset.ipfs) {
            this.data.asset.ipfs.hash = hash;
        }

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): IPFSBuilder {
        return this;
    }
}

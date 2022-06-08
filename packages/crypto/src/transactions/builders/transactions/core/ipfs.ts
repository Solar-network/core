import { ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class IPFSBuilder extends TransactionBuilder<IPFSBuilder> {
    public constructor() {
        super();

        this.data.type = Core.IpfsTransaction.type;
        this.data.typeGroup = Core.IpfsTransaction.typeGroup;
        this.data.fee = Core.IpfsTransaction.staticFee();
        this.data.vendorField = undefined;
        this.data.amount = BigNumber.ZERO;
        this.data.asset = {};
    }

    public ipfsAsset(ipfsId: string): IPFSBuilder {
        this.data.asset = {
            ipfs: ipfsId,
        };

        return this;
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.amount = this.data.amount;
        struct.asset = this.data.asset;

        super.validate(struct);
        return struct;
    }

    protected instance(): IPFSBuilder {
        return this;
    }
}
import { IHtlcLockAsset, ITransactionData } from "../../../../interfaces";
import { BigNumber } from "../../../../utils";
import { Core } from "../../../types";
import { TransactionBuilder } from "../transaction";

export class HtlcLockBuilder extends TransactionBuilder<HtlcLockBuilder> {
    public constructor() {
        super();

        this.data.type = Core.HtlcLockTransaction.type;
        this.data.typeGroup = Core.HtlcLockTransaction.typeGroup;
        this.data.recipientId = undefined;
        this.data.amount = BigNumber.ZERO;
        this.data.fee = Core.HtlcLockTransaction.staticFee();
        this.data.memo = undefined;
        this.data.asset = {};
    }

    public lockAsset(lockAsset: IHtlcLockAsset): HtlcLockBuilder {
        this.data.asset = {
            lock: lockAsset,
        };

        return this;
    }

    public amount(amount: string): HtlcLockBuilder {
        this.data.amount = BigNumber.make(amount);

        return this.instance();
    }

    public recipientId(recipientId: string): HtlcLockBuilder {
        this.data.recipientId = recipientId;

        return this.instance();
    }

    public getStruct(): ITransactionData {
        const struct: ITransactionData = super.getStruct();
        struct.recipientId = this.data.recipientId;
        struct.amount = this.data.amount;
        struct.asset = JSON.parse(JSON.stringify(this.data.asset));

        super.validate(struct);
        return struct;
    }

    public expiration(expiration: number): HtlcLockBuilder {
        return this;
    }

    protected instance(): HtlcLockBuilder {
        return this;
    }
}

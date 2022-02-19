import { Interfaces, Transactions, Utils } from "@arkecosystem/crypto";

import { SolarTransactionGroup, SolarTransactionType } from "../enums";
import { BurnTransaction } from "../transactions";

export class BurnTransactionBuilder extends Transactions.TransactionBuilder<BurnTransactionBuilder> {
    public constructor() {
        super();
        this.data.version = 2;
        this.data.typeGroup = SolarTransactionGroup;
        this.data.type = SolarTransactionType.Burn;
        this.data.fee = BurnTransaction.staticFee();
        this.data.amount = Utils.BigNumber.ZERO;
    }

    public getStruct(): Interfaces.ITransactionData {
        const struct: Interfaces.ITransactionData = super.getStruct();
        struct.amount = this.data.amount;
        return struct;
    }

    protected instance(): BurnTransactionBuilder {
        return this;
    }
}

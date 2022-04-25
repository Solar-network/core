import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ISerializeOptions } from "../../../interfaces";
import { BigNumber } from "../../../utils/bignum";
import { ByteBuffer } from "../../../utils/byte-buffer";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class DelegateResignationTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.DelegateResignation;
    public static key = "delegateResignation";
    public static version: number = 2;

    protected static defaultStaticFee: BigNumber = BigNumber.make("2500000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.delegateResignation;
    }

    public serialize(options?: ISerializeOptions): ByteBuffer | undefined {
        return new ByteBuffer(Buffer.alloc(0));
    }

    public deserialize(buf: ByteBuffer): void {
        return;
    }
}

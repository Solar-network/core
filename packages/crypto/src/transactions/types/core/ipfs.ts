import { base58 } from "bstring";

import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class IpfsTransaction extends Transaction {
    public static emoji: string = "🌐";
    public static key = "ipfs";
    public static type: number = TransactionType.Core.Ipfs;
    public static typeGroup: number = TransactionTypeGroup.Core;

    protected static defaultStaticFee: BigNumber = BigNumber.make("500000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.ipfs;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset) {
            const ipfsBuffer: Buffer = base58.decode(data.asset.ipfs);
            const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(ipfsBuffer.length));

            buf.writeBuffer(ipfsBuffer);

            return buf;
        }

        return undefined;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;

        const hashFunction: number = buf.readUInt8();
        const ipfsHashLength: number = buf.readUInt8();
        const ipfsHash: Buffer = buf.readBuffer(ipfsHashLength);

        const ipfsBuffer: Buffer = Buffer.alloc(ipfsHashLength + 2);
        ipfsBuffer.writeUInt8(hashFunction, 0);
        ipfsBuffer.writeUInt8(ipfsHashLength, 1);
        ipfsBuffer.fill(ipfsHash, 2);

        data.asset = {
            ipfs: base58.encode(ipfsBuffer),
        };
    }
}

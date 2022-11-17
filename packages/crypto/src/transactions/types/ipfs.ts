import { base58 } from "bstring";

import { ByteBuffer } from "../../utils";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export abstract class IpfsTransaction extends Transaction {
    public static emoji: string = "🌐";
    public static key = "ipfs";

    public static getSchema(): schemas.TransactionSchema {
        return schemas.ipfs;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;

        if (data.asset && data.asset.ipfs) {
            const ipfsBuffer: Buffer = base58.decode(data.asset.ipfs.hash);
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
            ipfs: {
                hash: base58.encode(ipfsBuffer),
            },
        };
    }
}

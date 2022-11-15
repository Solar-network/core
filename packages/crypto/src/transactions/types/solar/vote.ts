import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ByteBuffer } from "../../../utils/byte-buffer";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export class VoteTransaction extends Transaction {
    public static emoji: string = "🗳️";
    public static key: string = "vote";
    public static type: number = TransactionType.Solar.Vote;
    public static typeGroup: number = TransactionTypeGroup.Solar;
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.vote;
    }

    public serialise(): ByteBuffer {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(1024));

        if (data.asset && data.asset.votes) {
            buf.writeUInt8(Object.keys(data.asset.votes).length);
            for (const [vote, percent] of Object.entries(data.asset.votes)) {
                buf.writeUInt8(vote.length);
                buf.writeBuffer(Buffer.from(vote));
                buf.writeUInt16LE(Math.round(percent * 100));
            }
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const numberOfVotes: number = buf.readUInt8();
        data.asset = { votes: {} };

        for (let i = 0; i < numberOfVotes; i++) {
            const vote = buf.readBuffer(buf.readUInt8()).toString();
            const percent = buf.readUInt16LE() / 100;

            if (data.asset && data.asset.votes) {
                data.asset.votes[vote] = percent;
            }
        }
    }
}

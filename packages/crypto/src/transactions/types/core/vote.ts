import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export class LegacyVoteTransaction extends Transaction {
    public static emoji: string = "🗳️";
    public static key = "legacyVote";
    public static type: number = TransactionType.Core.Vote;
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.legacyVote;
    }

    public serialise(): ByteBuffer | undefined {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(69));

        if (data.asset && data.asset.votes) {
            const votes = data.asset.votes as string[];
            const voteBytes = votes
                .map((vote) => {
                    const prefix = vote.startsWith("+") ? "01" : "00";
                    const sliced = vote.slice(1);
                    if (sliced.length === 66) {
                        return prefix + sliced;
                    }

                    const hex: string =
                        vote.length.toString(16).padStart(2, "0") + prefix + Buffer.from(sliced).toString("hex");

                    if (data.version === 2) {
                        return "ff" + hex;
                    }

                    return hex;
                })
                .join("");
            buf.writeUInt8(votes.length);
            buf.writeBuffer(Buffer.from(voteBytes, "hex"));
        }

        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const voteLength: number = buf.readUInt8();
        data.asset = { votes: [] };

        for (let i = 0; i < voteLength; i++) {
            let vote: string;
            if (data.version === 2 && buf.readUInt8() !== 0xff) {
                buf.jump(-1);
                vote = buf.readBuffer(34).toString("hex");
                vote = (vote[1] === "1" ? "+" : "-") + vote.slice(2);
            } else {
                const length: number = buf.readUInt8();
                const voteBuffer: Buffer = buf.readBuffer(length);
                const prefix: number = voteBuffer.readUInt8();
                vote = (prefix === 1 ? "+" : "-") + voteBuffer.slice(1).toString();
            }

            if (data.asset && data.asset.votes) {
                (data.asset.votes as string[]).push(vote);
            }
        }
    }
}

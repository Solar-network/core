import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { ISerializeOptions } from "../../../interfaces";
import { BigNumber, ByteBuffer } from "../../../utils";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export class VoteTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Core.Vote;
    public static key = "vote";
    public static version: number = 1;

    protected static defaultStaticFee: BigNumber = BigNumber.make("100000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.vote;
    }

    public serialize(options?: ISerializeOptions): ByteBuffer | undefined {
        const { data } = this;
        const buff: ByteBuffer = new ByteBuffer(Buffer.alloc(69));

        if (data.asset && data.asset.votes) {
            const voteBytes = data.asset.votes
                .map((vote) => {
                    const prefix = vote.startsWith("+") ? "01" : "00";
                    const sliced = vote.slice(1);
                    if (sliced.length === 66) {
                        return prefix + sliced;
                    }

                    return (
                        "ff" + vote.length.toString(16).padStart(2, "0") + prefix + Buffer.from(sliced).toString("hex")
                    );
                })
                .join("");
            buff.writeUInt8(data.asset.votes.length);
            buff.writeBuffer(Buffer.from(voteBytes, "hex"));
        }

        return buff;
    }

    public deserialize(buf: ByteBuffer): void {
        const { data } = this;
        const voteLength: number = buf.readUInt8();
        data.asset = { votes: [] };

        for (let i = 0; i < voteLength; i++) {
            const firstByte: number = buf.readUInt8();
            let vote: string;
            if (firstByte !== 0xff) {
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
                data.asset.votes.push(vote);
            }
        }
    }
}

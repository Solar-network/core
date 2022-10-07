import { VoteType } from "../../enums";
import { ISerialiseOptions, ITransaction } from "../../interfaces";
import { ByteBuffer } from "../../utils/byte-buffer";
import * as schemas from "./schemas";
import { Transaction } from "./transaction";

export class VoteTransaction extends Transaction {
    public static emoji: string = "🗳️";
    public static key: string = "vote";
    public static unique: boolean = true;

    public static getSchema(): schemas.TransactionSchema {
        return schemas.vote;
    }

    public verify(options: ISerialiseOptions = {}): { transaction: ITransaction; verified: boolean } {
        const verificationResult = super.verify(options);
        const { verified } = verificationResult;

        if (
            !verified &&
            this.internalType === VoteType.Single &&
            this.data.asset?.votes &&
            Object.keys(this.data.asset.votes).length === 1
        ) {
            options.selfSwitchVote = true;
            return super.verify(options);
        }

        return verificationResult;
    }
    public serialise(options: ISerialiseOptions = {}): ByteBuffer | undefined {
        const { data } = this;
        const buf: ByteBuffer = new ByteBuffer(Buffer.alloc(1024));
        if (data.asset && data.asset.votes) {
            const voteEntries = Object.entries(data.asset.votes);
            if (options.selfSwitchVote) {
                voteEntries.unshift([voteEntries[0][0], voteEntries[0][1] === 100 ? 0 : 100]);
            }
            buf.writeUInt8(voteEntries.length);
            for (const [vote, percent] of voteEntries) {
                if (this.internalType === VoteType.Multiple) {
                    buf.writeUInt8(vote.length);
                    buf.writeBuffer(Buffer.from(vote));
                    buf.writeUInt16LE(Math.round(percent * 100));
                } else {
                    let voteBuffer: Buffer;
                    if (vote.length !== 66) {
                        if (data.version === 2) {
                            buf.writeUInt8(0xff);
                        }
                        buf.writeUInt8(vote.length + 1);
                        voteBuffer = Buffer.from(vote);
                    } else {
                        voteBuffer = Buffer.from(vote, "hex");
                    }
                    buf.writeUInt8(percent === 100 ? 1 : 0);
                    buf.writeBuffer(voteBuffer);
                }
            }
        }
        return buf;
    }

    public deserialise(buf: ByteBuffer): void {
        const { data } = this;
        const numberOfVotes: number = buf.readUInt8();
        data.asset = { votes: {} };
        if (data.asset && data.asset.votes) {
            for (let i = 0; i < numberOfVotes; i++) {
                if (this.internalType === VoteType.Multiple) {
                    const vote = buf.readBuffer(buf.readUInt8()).toString();
                    const percent = buf.readUInt16LE() / 100;

                    if (data.asset && data.asset.votes) {
                        data.asset.votes[vote] = percent;
                    }
                } else {
                    if (data.version === 2 && buf.readUInt8() !== 0xff) {
                        buf.jump(-1);
                        const vote: string = buf.readBuffer(34).toString("hex");
                        data.asset.votes[vote.slice(2)] = vote[1] === "1" ? 100 : 0;
                    } else {
                        const length: number = buf.readUInt8();
                        const prefix: number = buf.readUInt8();
                        const voteBuffer: Buffer = buf.readBuffer(length - 1);
                        data.asset.votes[voteBuffer.toString()] = prefix === 1 ? 100 : 0;
                    }
                }
            }
        }
    }
}

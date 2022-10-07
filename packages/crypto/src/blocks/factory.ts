import { Hash, HashAlgorithms } from "../crypto";
import { IBlock, IBlockData, IBlockJson, IDeserialiseOptions, IKeyPair, ITransaction } from "../interfaces";
import { BigNumber } from "../utils";
import { Block } from "./block";
import { Deserialiser } from "./deserialiser";
import { Serialiser } from "./serialiser";

export class BlockFactory {
    public static make(data: IBlockData, keys: IKeyPair, aux?: Buffer): IBlock {
        data.generatorPublicKey = keys.publicKey.secp256k1;

        const payloadHash: Buffer = Serialiser.serialise(data, false);
        const hash: Buffer = HashAlgorithms.sha256(payloadHash);

        data.signature = Hash.signSchnorr(hash, keys, aux);
        data.id = Block.getId(data);

        return this.fromData(data)!;
    }

    public static fromHex(hex: string): IBlock {
        return this.fromSerialised(Buffer.from(hex, "hex"));
    }

    public static fromBytes(buf: Buffer): IBlock {
        return this.fromSerialised(buf);
    }

    public static fromJson(json: IBlockJson, options?: IDeserialiseOptions): IBlock | undefined {
        const data: IBlockData = { ...json } as unknown as IBlockData;
        data.totalAmount = BigNumber.make(data.totalAmount);
        data.totalFee = BigNumber.make(data.totalFee);
        data.reward = BigNumber.make(data.reward);

        if (data.transactions) {
            for (const transaction of data.transactions) {
                if (transaction.amount) {
                    transaction.amount = BigNumber.make(transaction.amount);
                }
                transaction.fee = BigNumber.make(transaction.fee);
            }
        }
        return this.fromData(data, options);
    }

    public static fromData(data: IBlockData, options: IDeserialiseOptions = {}): IBlock | undefined {
        if (!data.previousBlock) {
            data.previousBlock = "0".repeat(64);
        }
        const block: IBlockData | undefined = Block.applySchema(data);

        if (block) {
            const serialised: Buffer = Serialiser.serialiseWithTransactions(data, options);
            const block: IBlock = new Block({
                ...Deserialiser.deserialise(serialised, false, options),
            });

            if (block.data.version === 0) {
                const username = data.username;
                if (!block.data.username && username) {
                    block.data.username = username;
                }
            }

            block.serialised = serialised.toString("hex");

            return block;
        }

        return undefined;
    }

    private static fromSerialised(serialised: Buffer): IBlock {
        const deserialised: { data: IBlockData; transactions: ITransaction[] } = Deserialiser.deserialise(serialised);

        const validated: IBlockData | undefined = Block.applySchema(deserialised.data);

        if (validated) {
            deserialised.data = validated;
        }

        const block: IBlock = new Block(deserialised);
        block.serialised = Serialiser.serialiseWithTransactions(block.data).toString("hex");

        return block;
    }
}

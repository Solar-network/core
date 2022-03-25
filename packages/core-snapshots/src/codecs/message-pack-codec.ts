import { Models } from "@solar-network/core-database";
import { Container } from "@solar-network/core-kernel";
import { Blocks, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { decode, encode } from "msgpack-lite";
import { camelizeKeys } from "xcase";

import { Codec } from "../contracts";
import { Codec as CodecException } from "../exceptions";

@Container.injectable()
export class MessagePackCodec implements Codec {
    private static removePrefix(item: Record<string, any>, prefix: string): Record<string, any> {
        const itemToReturn = {};

        for (const key of Object.keys(item)) {
            itemToReturn[key.replace(prefix, "")] = item[key];
        }

        return itemToReturn;
    }

    public encodeBlock(block: { Block_burned_fee: Utils.BigNumber; Block_id: string }): Buffer {
        try {
            const blockCamelized = camelizeKeys(MessagePackCodec.removePrefix(block, "Block_"));

            return encode([block.Block_burned_fee, Blocks.Serializer.serialize(blockCamelized, true)]);
        } catch (err) {
            throw new CodecException.BlockEncodeException(block.Block_id, err.message);
        }
    }

    public decodeBlock(buffer: Buffer): Models.Block {
        try {
            const [burnedFee, serialized] = decode(buffer);
            const data = Blocks.Deserializer.deserialize(serialized, false).data as Models.Block;
            data.burnedFee = burnedFee;
            return data;
        } catch (err) {
            throw new CodecException.BlockDecodeException(undefined, err.message);
        }
    }

    public encodeTransaction(transaction: {
        Transaction_id: string;
        Transaction_block_id: string;
        Transaction_block_height: number;
        Transaction_burned_fee: Utils.BigNumber;
        Transaction_sequence: number;
        Transaction_timestamp: number;
        Transaction_serialized: Buffer;
    }): Buffer {
        try {
            return encode([
                transaction.Transaction_id,
                transaction.Transaction_block_id,
                transaction.Transaction_block_height,
                transaction.Transaction_burned_fee,
                transaction.Transaction_sequence,
                transaction.Transaction_timestamp,
                transaction.Transaction_serialized,
            ]);
        } catch (err) {
            throw new CodecException.TransactionEncodeException(transaction.Transaction_id, err.message);
        }
    }

    public decodeTransaction(buffer: Buffer): Models.Transaction {
        let transactionId = undefined;
        try {
            const [id, blockId, blockHeight, burnedFee, sequence, timestamp, serialized] = decode(buffer);
            transactionId = id;

            const transaction: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytesUnsafe(
                serialized,
                id,
            );

            /* istanbul ignore next */
            return {
                id: id,
                version: transaction.data.version!,
                blockId: blockId,
                blockHeight: blockHeight,
                sequence: sequence,
                timestamp: timestamp,
                senderPublicKey: transaction.data.senderPublicKey!,
                // @ts-ignore
                recipientId: transaction.data.recipientId,
                type: transaction.data.type,
                vendorField: transaction.data.vendorField,
                amount: transaction.data.amount,
                fee: transaction.data.fee,
                burnedFee: burnedFee,
                serialized: serialized,
                typeGroup: transaction.data.typeGroup || 1,
                nonce: Utils.BigNumber.make(transaction.data.nonce || 0),
                // @ts-ignore
                asset: transaction.data.asset,
            };
        } catch (err) {
            throw new CodecException.TransactionDecodeException(transactionId as unknown as string, err.message);
        }
    }

    public encodeRound(round: { Round_round: string }): Buffer {
        try {
            const roundCamelized = camelizeKeys(MessagePackCodec.removePrefix(round, "Round_"));

            return encode([roundCamelized.publicKey, roundCamelized.balance, roundCamelized.round]);
        } catch (err) {
            throw new CodecException.RoundEncodeException(round.Round_round, err.message);
        }
    }

    public decodeRound(buffer: Buffer): Models.Round {
        try {
            const [publicKey, balance, round] = decode(buffer);

            return {
                publicKey,
                balance,
                round,
            };
        } catch (err) {
            throw new CodecException.RoundDecodeException(undefined, err.message);
        }
    }
}

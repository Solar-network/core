import { Blocks, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Models } from "@solar-network/database";
import { Container } from "@solar-network/kernel";
import { decode, encode } from "msgpack-lite";
import { camelizeKeys as cameliseKeys } from "xcase";

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

    public encodeBlock(block: {
        Block_burned_fee: Utils.BigNumber;
        Block_dev_fund: Utils.BigNumber;
        Block_id: string;
    }): Buffer {
        try {
            const blockCamelised = cameliseKeys(MessagePackCodec.removePrefix(block, "Block_"));

            return encode([
                block.Block_burned_fee,
                block.Block_dev_fund,
                Blocks.Serialiser.serialise(blockCamelised, true),
            ]);
        } catch (err) {
            throw new CodecException.BlockEncodeException(block.Block_id, err.message);
        }
    }

    public decodeBlock(buffer: Buffer): Models.Block {
        try {
            const [burnedFee, devFund, serialised] = decode(buffer);
            const data = Blocks.Deserialiser.deserialise(serialised, false).data as Models.Block;
            data.burnedFee = burnedFee;
            data.devFund = devFund;
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
        Transaction_serialised: Buffer;
    }): Buffer {
        try {
            return encode([
                transaction.Transaction_id,
                transaction.Transaction_block_id,
                transaction.Transaction_block_height,
                transaction.Transaction_burned_fee,
                transaction.Transaction_sequence,
                transaction.Transaction_timestamp,
                transaction.Transaction_serialised,
            ]);
        } catch (err) {
            throw new CodecException.TransactionEncodeException(transaction.Transaction_id, err.message);
        }
    }

    public decodeTransaction(buffer: Buffer): Models.Transaction {
        let transactionId = undefined;
        try {
            const [id, blockId, blockHeight, burnedFee, sequence, timestamp, serialised] = decode(buffer);
            transactionId = id;

            const transaction: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytesUnsafe(
                serialised,
                id,
            );

            return {
                id: id,
                version: transaction.data.version!,
                blockId: blockId,
                blockHeight: blockHeight,
                sequence: sequence,
                timestamp: timestamp,
                senderPublicKey: transaction.data.senderPublicKey!,
                recipientId: transaction.data.recipientId!,
                type: transaction.data.type,
                memo: transaction.data.memo,
                amount: transaction.data.amount,
                fee: transaction.data.fee,
                burnedFee: burnedFee,
                serialised: serialised,
                typeGroup: transaction.data.typeGroup || 1,
                nonce: Utils.BigNumber.make(transaction.data.nonce || 0),
                asset: transaction.data.asset!,
            };
        } catch (err) {
            throw new CodecException.TransactionDecodeException(transactionId as unknown as string, err.message);
        }
    }

    public encodeRound(round: { Round_round: string }): Buffer {
        try {
            const roundCamelised = cameliseKeys(MessagePackCodec.removePrefix(round, "Round_"));

            return encode([roundCamelised.publicKey, roundCamelised.balance, roundCamelised.round]);
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

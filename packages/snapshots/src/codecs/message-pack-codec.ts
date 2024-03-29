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
        Block_donations: Utils.BigNumber;
        Block_id: string;
        Block_username: string;
        Block_version: number;
    }): Buffer {
        try {
            const blockCamelised = cameliseKeys(MessagePackCodec.removePrefix(block, "Block_"));
            return encode([
                block.Block_burned_fee,
                block.Block_donations,
                block.Block_version === 0 ? block.Block_username : undefined,
                Blocks.Serialiser.serialise(blockCamelised, true),
            ]);
        } catch (err) {
            throw new CodecException.BlockEncodeException(block.Block_id, err.message);
        }
    }

    public decodeBlock(buffer: Buffer): Models.Block {
        try {
            const [burnedFee, donations, username, serialised] = decode(buffer);
            const data = Blocks.Deserialiser.deserialise(serialised, false).data as Models.Block;
            data.burnedFee = burnedFee;
            data.donations = donations;
            if (username) {
                data.username = username;
            }
            return data;
        } catch (err) {
            throw new CodecException.BlockDecodeException(undefined, err.message);
        }
    }

    public encodeMissedBlock(missedBlock: {
        MissedBlock_timestamp: number;
        MissedBlock_height: number;
        MissedBlock_username: string;
    }): Buffer {
        try {
            return encode([
                missedBlock.MissedBlock_timestamp,
                missedBlock.MissedBlock_height,
                missedBlock.MissedBlock_username,
            ]);
        } catch (err) {
            throw new CodecException.MissedBlockEncodeException(missedBlock.MissedBlock_timestamp, err.message);
        }
    }

    public decodeMissedBlock(buffer: Buffer): Models.MissedBlock {
        try {
            const [timestamp, height, username] = decode(buffer);
            return { timestamp, height, username };
        } catch (err) {
            throw new CodecException.MissedBlockDecodeException(undefined, err.message);
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
                senderId: transaction.data.senderId!,
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

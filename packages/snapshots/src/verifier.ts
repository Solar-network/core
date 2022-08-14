import { Blocks, Crypto, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Models } from "@solar-network/database";

import * as Exceptions from "./exceptions/verifier";

export class Verifier {
    public static verifyBlock(block: Models.Block, previousBlock: Models.Block | undefined): void {
        Verifier.isBlockChained(block, previousBlock);
        Verifier.verifyBlockSignature(block);
    }

    public static verifyMissedBlock(missedBlock: Models.MissedBlock): void {
        // nothing to verify
    }

    public static verifyTransaction(transaction: Models.Transaction): void {
        Verifier.verifyTransactionSignature(transaction);
    }

    public static verifyRound(round: Models.Round): void {
        if (round.publicKey.length !== 66) {
            throw new Exceptions.RoundVerifyException(round.round.toString());
        }
    }

    private static isBlockChained(block: Models.Block, previousBlock: Models.Block | undefined): void {
        if (!previousBlock) {
            return;
        }

        const isBlockChained = block.height - previousBlock.height === 1 && block.previousBlock === previousBlock.id;

        if (!isBlockChained) {
            throw new Exceptions.BlockNotChainedException(block.id);
        }
    }

    private static verifyBlockSignature(blockEntity: Models.Block): void {
        let isVerified = false;

        try {
            const block = Blocks.BlockFactory.fromData(blockEntity as Interfaces.IBlockData)!;

            const bytes = Blocks.Serialiser.serialise(block.data, false);
            const hash = Crypto.HashAlgorithms.sha256(bytes);

            const { bip340 } = Managers.configManager.getMilestone(blockEntity.height);

            isVerified = Crypto.Hash.verifySchnorr(
                hash,
                blockEntity.blockSignature,
                blockEntity.generatorPublicKey,
                bip340,
            );
        } catch (err) {
            throw new Exceptions.BlockVerifyException(blockEntity.id, err.message);
        }

        if (!isVerified) {
            throw new Exceptions.BlockVerifyException(blockEntity.id);
        }
    }

    private static verifyTransactionSignature(transaction: Models.Transaction): void {
        if (transaction.timestamp === 0) {
            return;
        }

        let isVerified = false;
        try {
            const transactionDeserialised = Transactions.TransactionFactory.fromBytes(transaction.serialised);
            if (transactionDeserialised.data.signatures) {
                return;
            } else {
                isVerified = transactionDeserialised.isVerified;
            }
        } catch (err) {
            throw new Exceptions.TransactionVerifyException(transaction.id, err.message);
        }

        if (!isVerified) {
            throw new Exceptions.TransactionVerifyException(transaction.id);
        }
    }
}

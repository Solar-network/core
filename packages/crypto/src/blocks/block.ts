import { Managers } from "..";
import { Hash, HashAlgorithms, Slots } from "../crypto";
import { BlockSchemaError } from "../errors";
import { IBlock, IBlockData, IBlockJson, IBlockVerification, ITransaction, ITransactionData } from "../interfaces";
import { configManager } from "../managers/config";
import { BigNumber, calculateDevFund, isException } from "../utils";
import { validator } from "../validation";
import { Serialiser } from "./serialiser";

export class Block implements IBlock {
    public serialised!: string;
    public data: IBlockData;
    public transactions: ITransaction[];
    public verification: IBlockVerification;

    public constructor({ data, transactions, id }: { data: IBlockData; transactions: ITransaction[]; id?: string }) {
        this.data = data;

        this.transactions = transactions.map((transaction, index) => {
            transaction.data.blockId = this.data.id;
            transaction.data.blockHeight = this.data.height;
            transaction.data.sequence = index;
            transaction.timestamp = this.data.timestamp;
            return transaction;
        });

        delete this.data.transactions;

        this.data.burnedFee = this.getBurnedFees();

        this.data.devFund = calculateDevFund(this.data.height, this.data.reward);

        this.verification = this.verify();
    }

    public static applySchema(data: IBlockData): IBlockData | undefined {
        let result = validator.validate("block", data);

        if (!result.error) {
            return result.value;
        }

        result = validator.validateException("block", data);

        if (!result.errors) {
            return result.value;
        }

        for (const err of result.errors) {
            let fatal = false;

            const match = err.dataPath.match(/\.transactions\[([0-9]+)\]/);
            if (match === null) {
                if (!isException(data)) {
                    fatal = true;
                }
            } else {
                const txIndex = match[1];

                if (data.transactions) {
                    const tx = data.transactions[txIndex];

                    if (tx.id === undefined || !isException(tx)) {
                        fatal = true;
                    }
                }
            }

            if (fatal) {
                throw new BlockSchemaError(
                    data.height,
                    `Invalid data${err.dataPath ? " at " + err.dataPath : ""}: ` +
                        `${err.message}: ${JSON.stringify(err.data)}`,
                );
            }
        }

        return result.value;
    }

    public static getId(data: IBlockData): string {
        const payloadHash: Buffer = Serialiser.serialise(data);

        const hash: Buffer = HashAlgorithms.sha256(payloadHash);

        return hash.toString("hex");
    }

    public static toBytesHex(data: string | undefined): string {
        const temp: string = data ? BigNumber.make(data).toString(16) : "";

        return "0".repeat(16 - temp.length) + temp;
    }

    public static getBasicHeader(data: IBlockData, withExtraData: boolean = true): IBlockData {
        return {
            blockSignature: data.blockSignature,
            burnedFee: withExtraData ? data.burnedFee : undefined,
            generatorPublicKey: data.generatorPublicKey,
            height: data.height,
            id: data.id,
            numberOfTransactions: data.numberOfTransactions,
            payloadHash: data.payloadHash,
            payloadLength: data.payloadLength,
            previousBlock: data.previousBlock,
            reward: data.reward,
            timestamp: data.timestamp,
            totalAmount: data.totalAmount,
            totalFee: data.totalFee,
            username: withExtraData ? data.username : undefined,
            version: data.version,
        };
    }

    public getBurnedFees(): BigNumber {
        let fees: BigNumber = BigNumber.ZERO;
        for (const transaction of this.transactions) {
            transaction.setBurnedFee(this.data.height);
            fees = fees.plus(transaction.data.burnedFee!);
        }
        return fees;
    }

    public getHeader(withExtraData: boolean = true): IBlockData {
        return Block.getBasicHeader(this.data, withExtraData);
    }

    public verifySignature(): boolean {
        const { bip340 } = configManager.getMilestone(this.data.height);
        const bytes: Buffer = Serialiser.serialise(this.data, false);
        const hash: Buffer = HashAlgorithms.sha256(bytes);

        if (!this.data.blockSignature) {
            throw new Error();
        }

        return Hash.verifySchnorr(hash, this.data.blockSignature, this.data.generatorPublicKey, bip340);
    }

    public toJson(): IBlockJson {
        const data: IBlockJson = JSON.parse(JSON.stringify(this.data));
        data.reward = this.data.reward.toString();
        data.totalAmount = this.data.totalAmount.toString();
        data.totalFee = this.data.totalFee.toString();
        data.burnedFee = this.data.burnedFee!.toString();
        data.transactions = this.transactions.map((transaction) => transaction.toJson());

        return data;
    }

    public verify(): IBlockVerification {
        const block: IBlockData = this.data;
        const result: IBlockVerification = {
            verified: false,
            containsMultiSignatures: false,
            errors: [],
        };

        try {
            const constants = configManager.getMilestone(block.height);

            if (block.height !== 1) {
                if (!block.previousBlock) {
                    result.errors.push("Invalid previous block");
                }
            }

            const valid = this.verifySignature();

            if (!valid) {
                result.errors.push("Failed to verify block signature");
            }

            if (block.version !== constants.block.version) {
                result.errors.push("Invalid block version");
            }

            if (block.timestamp > Slots.getTime() + Managers.configManager.getMilestone(block.height).blockTime) {
                result.errors.push("Invalid block timestamp");
            }

            const size: number = Serialiser.size(this);
            if (size > constants.block.maxPayload) {
                result.errors.push(`Payload is too large: ${size} > ${constants.block.maxPayload}`);
            }

            const invalidTransactions: ITransaction[] = this.transactions.filter((tx) => !tx.verified);
            if (invalidTransactions.length > 0) {
                result.errors.push("One or more transactions are not verified:");

                for (const invalidTransaction of invalidTransactions) {
                    result.errors.push(`=> ${invalidTransaction.serialised.toString("hex")}`);
                }

                result.containsMultiSignatures = invalidTransactions.some((tx) => !!tx.data.signatures);
            }

            if (this.transactions.length !== block.numberOfTransactions) {
                result.errors.push("Invalid number of transactions");
            }

            if (this.transactions.length > constants.block.maxTransactions) {
                if (block.height > 1) {
                    result.errors.push("Transactions length is too high");
                }
            }

            // Checking if transactions of the block adds up to block values.
            const appliedTransactions: Record<string, ITransactionData> = {};

            let totalAmount: BigNumber = BigNumber.ZERO;
            let totalFee: BigNumber = BigNumber.ZERO;

            const payloadBuffers: Buffer[] = [];
            for (const transaction of this.transactions) {
                if (!transaction.data || !transaction.data.id) {
                    throw new Error();
                }

                const bytes: Buffer = Buffer.from(transaction.data.id, "hex");

                if (appliedTransactions[transaction.data.id]) {
                    result.errors.push(`Encountered duplicate transaction: ${transaction.data.id}`);
                }

                if (
                    transaction.data.expiration &&
                    transaction.data.expiration > 0 &&
                    transaction.data.expiration <= this.data.height
                ) {
                    result.errors.push(`Encountered expired transaction: ${transaction.data.id}`);
                }

                appliedTransactions[transaction.data.id] = transaction.data;

                totalAmount = totalAmount.plus(transaction.data.amount || BigNumber.ZERO);
                totalFee = totalFee.plus(transaction.data.fee);

                payloadBuffers.push(bytes);
            }

            if (!totalAmount.isEqualTo(block.totalAmount)) {
                result.errors.push("Invalid total amount");
            }

            if (!totalFee.isEqualTo(block.totalFee)) {
                result.errors.push("Invalid total fee");
            }

            if (HashAlgorithms.sha256(payloadBuffers).toString("hex") !== block.payloadHash) {
                result.errors.push("Invalid payload hash");
            }
        } catch (error) {
            result.errors.push(error);
        }

        result.verified = result.errors.length === 0;

        return result;
    }
}

import { Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

import { BigNumber, Buffer, Identity } from "./decorators";

export class BlockModel implements Contracts.Database.BlockModel {
    @Buffer()
    public id!: string;

    @BigNumber()
    public totalAmount!: Utils.BigNumber;

    @BigNumber()
    public totalFee!: Utils.BigNumber;

    @BigNumber()
    public reward!: Utils.BigNumber;

    @Buffer()
    public payloadHash!: string;

    @Buffer()
    public previousBlock!: string;

    @Buffer()
    public signature!: string;

    @Buffer()
    public generatorPublicKey!: string;

    @Identity()
    public username!: string;

    public version!: number;

    public timestamp!: number;

    public height!: number;

    public numberOfTransactions!: number;

    public payloadLength!: number;

    public static from(model: BlockModel): Record<string, any> {
        return {
            id: model.id,
            version: model.version,
            height: model.height,
            timestamp: model.timestamp,
            number_of_transactions: model.numberOfTransactions,
            total_amount: model.totalAmount,
            total_fee: model.totalFee,
            reward: model.reward,
            payload_length: model.payloadLength,
            payload_hash: model.payloadHash,
            signature: model.signature,
            foreignKeys: {
                previousBlock: model.previousBlock,
                generatorPublicKey: model.generatorPublicKey,
                username: model.username,
            },
        };
    }

    public static to(raw: Record<string, any>): BlockModel {
        return Object.assign({}, new BlockModel(), {
            id: raw.id,
            version: raw.version,
            height: raw.height,
            timestamp: raw.timestamp,
            numberOfTransactions: raw.numberOfTransactions,
            totalAmount: raw.totalAmount,
            totalFee: raw.totalFee,
            totalFeeBurned: raw.totalFeeBurned,
            reward: raw.reward,
            payloadLength: raw.payloadLength,
            payloadHash: raw.payloadHash,
            signature: raw.signature,
            previousBlock: raw.previousBlock,
            generatorPublicKey: raw.generatorPublicKey,
            username: raw.username,
        });
    }
}

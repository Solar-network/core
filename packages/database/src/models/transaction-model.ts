import { Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

import { Base58, BigNumber, Buffer, Identity } from "./decorators";

export class TransactionModel implements Contracts.Database.TransactionModel {
    @Buffer()
    public id!: string;

    @BigNumber()
    public nonce!: Utils.BigNumber;

    @BigNumber()
    public fee!: Utils.BigNumber;

    @BigNumber()
    public burnedFee!: Utils.BigNumber;

    @Buffer()
    public serialised!: Buffer;

    @Identity()
    public senderId!: string;

    @Buffer()
    public senderPublicKey!: string;

    @Identity()
    public recipientId?: string;

    @Base58()
    public hash?: string;

    public version!: number;

    public blockHeight!: number;

    public sequence!: number;

    public memo: string | undefined;

    public timestamp!: number;

    public type!: string;

    public static from(model: TransactionModel): Record<string, any> {
        return {
            id: model.id,
            version: model.version,
            block_height: model.blockHeight,
            sequence: model.sequence,
            nonce: model.nonce,
            memo: model.memo,
            fee: model.fee,
            serialised: model.serialised,
            timestamp: model.timestamp,
            foreignKeys: {
                senderId: model.senderId,
                senderPublicKey: model.senderPublicKey,
                type: model.type,
            },
        };
    }

    public static to(raw: Record<string, any>): TransactionModel {
        return Object.assign({}, new TransactionModel(), {
            id: raw.id,
            version: raw.version,
            blockHeight: raw.blockHeight,
            sequence: raw.sequence,
            nonce: raw.nonce,
            memo: raw.memo,
            fee: raw.fee,
            burnedFee: raw.burnedFee,
            serialised: raw.serialised,
            timestamp: raw.timestamp,
            senderId: raw.senderId,
            senderPublicKey: raw.senderPublicKey,
            type: raw.type,
        });
    }
}

import { Utils } from "@solar-network/crypto";
export interface Model {}

export interface BlockModel extends Model {
    id: string;
    version: number;
    timestamp: number;
    previousBlock: string;
    height: number;
    numberOfTransactions: number;
    totalAmount: Utils.BigNumber;
    totalFee: Utils.BigNumber;
    reward: Utils.BigNumber;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;
    signature: string;

    donations?: Record<string, Utils.BigNumber>;
    totalFeeBurned?: Utils.BigNumber;
    username?: string;
}

export interface IdentityModel extends Model {
    id: number;
    identity: string;
    isUsername: boolean;
}

export interface MigrationModel extends Model {
    id: number;
    name: string;
    timestamp: number;
}

export interface MissedBlockModel extends Model {
    timestamp: number;
    height: number;
    username: string;
}

export interface PublicKeyModel extends Model {
    id: number;
    publicKey: string;
}

export interface RoundModel extends Model {
    balance: Utils.BigNumber;
    publicKey: string;
    round: number;
    username: string;
}

export interface TransactionModel extends Model {
    id: string;
    version: number;
    blockHeight: number;
    sequence: number;
    nonce: Utils.BigNumber;
    senderId: string;
    senderPublicKey: string;
    type: string;
    memo: string | undefined;
    fee: Utils.BigNumber;
    serialised: Buffer;
    timestamp: number;

    burnedFee?: Utils.BigNumber;
    identity?: Buffer;
    publicKey?: Buffer;
}

export interface TypeModel extends Model {
    id: number;
    type: string;
}

import { ErrorObject } from "ajv";

import { BigNumber, ByteBuffer } from "../utils";

export interface ITransaction {
    readonly emoji: string;
    readonly id: string | undefined;
    readonly key: string;
    readonly verified: boolean;

    isVerified: boolean;

    addresses: IDeserialiseAddresses;
    data: ITransactionData;
    serialised: Buffer;
    timestamp: number;
    internalType: string;

    setBurnedFee(height: number): void;

    serialise(options?: ISerialiseOptions): ByteBuffer | undefined;
    deserialise(buf: ByteBuffer, options?: IDeserialiseOptions): void;

    verify(options?: IVerifyOptions): { transaction: ITransaction; verified: boolean };
    verifySchema(strict?: boolean): ISchemaValidationResult;

    toJson(): ITransactionJson;
}

export interface ITransactionAsset {
    [custom: string]: any;

    burn?: IBurnAsset;
    ipfs?: { hash: string };
    recipients?: ITransferRecipient[];
    registration?: { username: string };
    resignation?: { type: number };
    signature?: { publicKey: string };
    votes?: IVoteAsset;
}

export interface ITransactionData {
    version: number;
    network?: number;
    typeGroup?: number; // transitional
    type: string;
    nonce: BigNumber;
    senderId: string;
    senderPublicKey: string;
    headerType?: number;

    fee: BigNumber;
    burnedFee?: BigNumber;
    amount?: BigNumber; // transitional

    expiration?: number;
    recipientId?: string; // transitional

    asset?: ITransactionAsset;
    memo?: string;

    id?: string;
    secondSignature?: string;
    signature?: string;
    signatures?: ITransactionSignature;

    blockHeight?: number;
    sequence?: number;
}

export interface ITransactionJson {
    version?: number;
    network?: number;

    type: string;

    nonce: string;
    senderId: string;
    senderPublicKey: string;

    fee: string;
    burnedFee: string;

    expiration?: number;

    asset?: ITransactionAsset;
    memo?: string | undefined;

    id?: string;
    secondSignature?: string;
    signature?: string;
    signatures?: ITransactionSignature;

    sequence?: number;

    ipfsHash?: string;
}

export interface ITransactionSignature {
    primary?: string;
    extra?: string;
}

export interface ISchemaValidationResult<T = any> {
    value: T | undefined;
    error: any;
    errors?: ErrorObject[] | undefined;
}

export interface ITransferRecipient {
    amount: BigNumber;
    recipientId: string;
}

export interface IBurnAsset {
    amount: BigNumber;
}

export interface IVoteAsset {
    [custom: string]: number;
}

export interface IDeserialiseOptions {
    acceptLegacyVersion?: boolean;
    deserialiseTransactionsUnchecked?: boolean;
    disableVersionCheck?: boolean;
    index?: number;
    isGenesisBlock?: boolean;
    transactionAddresses?: IDeserialiseAddresses;
}

export interface IDeserialiseAddresses {
    senderId: string;
    recipientId?: string[];
}

export interface IVerifyOptions {
    disableVersionCheck?: boolean;
}

export interface ISerialiseOptions {
    acceptLegacyVersion?: boolean;
    addressError?: string;
    disableVersionCheck?: boolean;
    excludeSignature?: boolean;
    excludeExtraSignature?: boolean;
    index?: number;
    selfSwitchVote?: boolean;
}

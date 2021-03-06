import { ErrorObject } from "ajv";

import { HtlcLockExpirationType, HtlcSecretHashType } from "../enums";
import { BigNumber, ByteBuffer } from "../utils";

export interface ITransaction {
    readonly id: string | undefined;
    readonly typeGroup: number | undefined;
    readonly type: number;
    readonly verified: boolean;
    readonly key: string;
    readonly staticFee: BigNumber;

    isVerified: boolean;

    data: ITransactionData;
    serialised: Buffer;
    timestamp: number;

    setBurnedFee(height: number): void;

    serialise(options?: ISerialiseOptions): ByteBuffer | undefined;
    deserialise(buf: ByteBuffer): void;

    verify(options?: IVerifyOptions): boolean;
    verifySchema(strict?: boolean): ISchemaValidationResult;

    toJson(): ITransactionJson;
}

export interface ITransactionAsset {
    [custom: string]: any;

    signature?: {
        publicKey: string;
    };
    delegate?: {
        username: string;
    };
    votes?: string[] | object;
    multiSignature?: IMultiSignatureAsset;
    ipfs?: string;
    transfers?: ITransferItem[];
    lock?: IHtlcLockAsset;
    claim?: IHtlcClaimAsset;
    refund?: IHtlcRefundAsset;
}

export interface ITransactionData {
    version: number;
    network?: number;

    typeGroup?: number;
    type: number;
    timestamp: number;
    nonce: BigNumber;
    senderPublicKey: string;
    headerType?: number;

    fee: BigNumber;
    burnedFee?: BigNumber;
    amount: BigNumber;

    expiration?: number;
    recipientId?: string;

    asset?: ITransactionAsset;
    memo?: string;
    vendorField?: string;

    id?: string;
    signature?: string;
    secondSignature?: string;
    signSignature?: string;
    signatures?: string[];

    blockId?: string;
    blockHeight?: number;
    sequence?: number;
}

export interface ITransactionJson {
    version?: number;
    network?: number;

    typeGroup?: number;
    type: number;

    timestamp?: number;
    nonce: string;
    senderPublicKey: string;

    fee: string;
    burnedFee: string;
    amount: string;

    expiration?: number;
    recipientId?: string;

    asset?: ITransactionAsset;
    memo?: string | undefined;

    id?: string;
    signature?: string;
    secondSignature?: string;
    signSignature?: string;
    signatures?: string[];

    blockId?: string;
    sequence?: number;

    ipfsHash?: string;
}

export interface ISchemaValidationResult<T = any> {
    value: T | undefined;
    error: any;
    errors?: ErrorObject[] | undefined;
}

export interface ITransferItem {
    amount: BigNumber;
    recipientId: string;
}

export interface IMultiSignatureAsset {
    min: number;
    publicKeys: string[];
}

export interface IHtlcLockAsset {
    secretHash: string;
    expiration: {
        type: HtlcLockExpirationType;
        value: number;
    };
}

export interface IHtlcClaimAsset {
    hashType: HtlcSecretHashType;
    lockTransactionId: string;
    unlockSecret: string;
}

export interface IHtlcRefundAsset {
    lockTransactionId: string;
}

export interface IHtlcLock extends IHtlcLockAsset {
    amount: BigNumber;
    recipientId: string | undefined;
    timestamp: number;
    memo: string | undefined;
}

export type IHtlcLocks = Record<string, IHtlcLock>;

export interface IHtlcExpiration {
    type: HtlcLockExpirationType;
    value: number;
}

export interface IDeserialiseOptions {
    acceptLegacyVersion?: boolean;
    disableVersionCheck?: boolean;
}

export interface IVerifyOptions {
    disableVersionCheck?: boolean;
}

export interface ISerialiseOptions {
    acceptLegacyVersion?: boolean;
    disableVersionCheck?: boolean;
    excludeSignature?: boolean;
    excludeSecondSignature?: boolean;
    excludeMultiSignature?: boolean;

    // WORKAROUND: A handful of mainnet transactions have an invalid
    // recipient. Due to a refactor of the Address network byte
    // validation it is no longer trivially possible to handle them.
    // If an invalid address is encountered during transfer serialization,
    // this error field is used to bubble up the error and defer the
    // `AddressNetworkByteError` until the actual id is available to call `isException`.
    addressError?: string;
}

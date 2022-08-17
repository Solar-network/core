export enum CoreTransactionType {
    LegacyTransfer = 0,
    SecondSignature = 1,
    DelegateRegistration = 2,
    Vote = 3,
    MultiSignature = 4,
    Ipfs = 5,
    Transfer = 6,
    DelegateResignation = 7,
    HtlcLock = 8,
    HtlcClaim = 9,
    HtlcRefund = 10,
}

export enum SolarTransactionType {
    Burn = 0,
    Vote = 2,
}

export enum TransactionHeaderType {
    Standard = 0,
    Extended = 1,
}

export const TransactionType = {
    Core: CoreTransactionType,
    Solar: SolarTransactionType,
    ...CoreTransactionType,
};

export enum TransactionTypeGroup {
    Test = 0,
    Core = 1,
    Solar = 2,

    // Everything above is available to anyone
    Reserved = 1000,
}

export enum DelegateStatus {
    TemporaryResign = 0,
    PermanentResign = 1,
    NotResigned = 2,
}

export enum HtlcLockExpirationType {
    EpochTimestamp = 1,
    BlockHeight = 2,
}

export enum HtlcSecretHashType {
    SHA256 = 0,
    SHA384 = 1,
    SHA512 = 2,
    SHA3256 = 3,
    SHA3384 = 4,
    SHA3512 = 5,
    Keccak256 = 6,
    Keccak384 = 7,
    Keccak512 = 8,
}

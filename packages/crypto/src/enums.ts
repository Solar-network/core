export enum CoreTransactionType {
    Transfer = 0,
    SecondSignature = 1,
    DelegateRegistration = 2,
    Vote = 3,
    MultiSignature = 4,
    Ipfs = 5,
    MultiPayment = 6,
    DelegateResignation = 7,
    HtlcLock = 8,
    HtlcClaim = 9,
    HtlcRefund = 10,
}

export enum SolarTransactionType {
    Burn = 0,
}

export const TransactionType = {
    Core: CoreTransactionType,
    Solar: SolarTransactionType,
};

export enum TransactionTypeGroup {
    Test = 0,
    Core = 1,
    Solar = 2,

    // Everything above is available to anyone
    Reserved = 1000,
}

export enum HtlcLockExpirationType {
    EpochTimestamp = 1,
    BlockHeight = 2,
}

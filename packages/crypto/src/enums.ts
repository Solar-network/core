export enum TransactionHeaderType {
    Standard = 0,
    Extended = 1,
}

export enum DelegateStatus {
    TemporaryResign = 0,
    PermanentResign = 1,
    NotResigned = 2,
}

export enum DelegateType {
    Registration = "1/2",
    Resignation = "1/7",
}

export enum OtherType {
    Burn = "2/0",
    ExtraSignature = "1/1",
    IPFS = "1/5",
}

export enum TransferType {
    Multiple = "1/6",
    Single = "1/0",
}

export enum VoteType {
    Multiple = "2/2",
    Single = "1/3",
}

export const TransactionType = {
    burn: [OtherType.Burn],
    delegateRegistration: [DelegateType.Registration],
    delegateResignation: [DelegateType.Resignation],
    extraSignature: [OtherType.ExtraSignature],
    ipfs: [OtherType.IPFS],
    transfer: [TransferType.Multiple, TransferType.Single],
    vote: [VoteType.Multiple, VoteType.Single],
};

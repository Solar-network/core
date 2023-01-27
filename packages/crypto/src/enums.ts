export enum TransactionHeaderType {
    Standard = 0,
    Extended = 1,
}

export enum BlockProducerStatus {
    TemporaryResign = 0,
    PermanentResign = 1,
    NotResigned = 2,
}

export enum BlockProducerType {
    Resignation = "1/7",
}

export enum UsernameType {
    Registration = "1/2",
    Upgrade = "2/3",
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
    registration: [UsernameType.Registration],
    resignation: [BlockProducerType.Resignation],
    extraSignature: [OtherType.ExtraSignature],
    ipfs: [OtherType.IPFS],
    transfer: [TransferType.Multiple, TransferType.Single],
    vote: [VoteType.Multiple, VoteType.Single],
    upgrade: [UsernameType.Upgrade],
};

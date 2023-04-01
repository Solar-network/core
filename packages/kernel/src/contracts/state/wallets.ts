import { Interfaces, Utils } from "@solar-network/crypto";

export interface WalletBasic {
    address: string;
    publicKeys?: Record<string, string | WalletPermissions>;
    balance: Utils.BigNumber;
    burned: Utils.BigNumber;
    rank?: number;
    nonce: Utils.BigNumber;
    attributes: Record<string, any>;
    transactions: WalletTransactions;
    votingFor: Record<string, WalletVoteDistribution>;
}

export interface WalletIndex {
    readonly indexer: WalletIndexer;
    readonly autoIndex: boolean;
    index(wallet: Wallet, blockchainWallet?: Wallet): void;
    has(key: string): boolean;
    get(key: string): Wallet | undefined;
    set(key: string, wallet: Wallet): void;
    forget(key: string): void;
    forgetWallet(wallet: Wallet): void;
    entries(): ReadonlyArray<[string, Wallet]>;
    values(): ReadonlyArray<Wallet>;
    keys(): string[];
    walletKeys(wallet: Wallet): string[];
    clear(): void;
}

export interface WalletPermissions {
    types?: string[];
}

export interface WalletTransactions {
    received: {
        total: number;
        types?: {
            [type: string]: {
                count: number;
                first?: {
                    id: string;
                    timestamp?: number | object;
                };
                last?: {
                    id: string;
                    timestamp?: number | object;
                };
            };
        };
    };
    sent: {
        total: number;
        types?: {
            [type: string]: {
                count: number;
                first?: {
                    id: string;
                    timestamp?: number | object;
                };
                last?: {
                    id: string;
                    timestamp?: number | object;
                };
            };
        };
    };
}

export type WalletIndexer = (index: WalletIndex, wallet: Wallet, blockchainWallet?: Wallet) => void;

export type WalletIndexerIndex = { name: string; indexer: WalletIndexer; autoIndex: boolean };

export enum WalletIndexes {
    Addresses = "addresses",
    PublicKeys = "publicKeys",
    Usernames = "usernames",
    Resignations = "resignations",
    Ipfs = "ipfs",
    Businesses = "businesses",
    BridgeChains = "bridgechains",
}

export interface WalletData {
    address: string;
    publicKey: string;
    balance: Utils.BigNumber;
    burned: Utils.BigNumber;
    nonce: Utils.BigNumber;
    attributes: Record<string, any>;
}

export interface Wallet {
    countAttributes(): number;

    getAddress(): string;

    hasPublicKey(publicKey: string): boolean;

    hasPublicKeyByType(type: string): boolean;

    forgetPublicKey(type: string): void;

    getPublicKey(type: string): string | undefined;

    getPublicKeys(): Record<string, string | WalletPermissions>;

    setPublicKey(publicKey: string, type: string, permissions?: object): void;

    setPublicKeys(publicKeys: Record<string, string | WalletPermissions>): void;

    getBalance(): Utils.BigNumber;

    setBalance(balance: Utils.BigNumber): void;

    getBurned(): Utils.BigNumber;

    setBurned(burned: Utils.BigNumber): void;

    increaseBurned(burned: Utils.BigNumber): Wallet;

    decreaseBurned(burned: Utils.BigNumber): Wallet;

    getNonce(): Utils.BigNumber;

    setNonce(nonce: Utils.BigNumber): void;

    increaseBalance(balance: Utils.BigNumber): Wallet;

    decreaseBalance(balance: Utils.BigNumber): Wallet;

    increaseNonce(): void;

    decreaseNonce(): void;

    increaseReceivedTransactions(newTransactionData: Interfaces.ITransactionData): void;

    decreaseReceivedTransactions(
        oldTransactionData: Interfaces.ITransactionData,
        previousTransactionData?: Interfaces.ITransactionData,
    ): void;

    increaseSentTransactions(newTransactionData: Interfaces.ITransactionData): void;

    decreaseSentTransactions(
        oldTransactionData: Interfaces.ITransactionData,
        previousTransactionData?: Interfaces.ITransactionData,
    ): void;

    getTransactions(): WalletTransactions;

    setTransactions(transactions: WalletTransactions): void;

    getData(): WalletData;

    setRank(rank: number): void;
    getRank(): number | undefined;

    /**
     * @returns {Record<string, any>}
     * @memberof Wallet
     */
    getAttributes(): Record<string, any>;

    /**
     * @template T
     * @param {string} key
     * @param {T} [defaultValue]
     * @returns {T}
     * @memberof Wallet
     */
    getAttribute<T = any>(key: string, defaultValue?: T): T;

    /**
     * @template T
     * @param {string} key
     * @param {T} value
     * @returns {boolean}
     * @memberof Wallet
     */
    setAttribute<T = any>(key: string, value: T): boolean;

    /**
     * @param {string} key
     * @returns {boolean}
     * @memberof Wallet
     */
    forgetAttribute(key: string): boolean;

    /**
     * @param {string} key
     * @returns {boolean}
     * @memberof Wallet
     */
    hasAttribute(key: string): boolean;

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    isBlockProducer(): boolean;

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    hasVoted(): boolean;

    /**
     * @param {string} blockProducer
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    getVoteBalance(blockProducer: string): Utils.BigNumber;

    /**
     * @returns {Map<string, Utils.BigNumber>}
     * @memberof Wallet
     */
    getVoteBalances(): Map<string, Utils.BigNumber>;

    /**
     * @param {object} balances
     * @memberof Wallet
     */
    setVoteBalances(balances: object): void;

    /**
     * @returns {Map<string, WalletVoteDistribution>}
     * @memberof Wallet
     */
    getVoteDistribution(): Map<string, WalletVoteDistribution>;

    updateVoteBalances(): void;

    /**
     * @returns {Wallet}
     * @memberof Wallet
     */
    clone(): Wallet;

    calculateVoteAmount(
        balances: { balance: Utils.BigNumber },
        blockProducers?: Map<string, number>,
    ): Map<string, Record<string, Utils.BigNumber>>;

    getBasicWallet();
}

export type WalletFactory = (address: string) => Wallet;

export interface WalletBlockProducerAttributes {
    voteBalance: Utils.BigNumber;
    voters: number;
    fees: Utils.BigNumber;
    burnedFees: Utils.BigNumber;
    rewards: Utils.BigNumber;
    donations: Utils.BigNumber;
    producedBlocks: number;
    publicKey?: string;
    rank?: number;
    lastBlock?: Interfaces.IBlockData;
    round?: number;
    resigned?: boolean;
    version?: string;
}

export interface WalletVoteDistribution {
    percent: number;
    votes: Utils.BigNumber;
}

export interface WalletIpfsAttributes {
    [hash: string]: boolean;
}

export interface WalletRepository {
    // TODO: use an inversify factory for wallets instead?
    createWallet(address: string): Wallet;

    reset(): void;

    getIndex(name: string): WalletIndex;

    allBlockProducers(): ReadonlyArray<Wallet>;

    allByAddress(): ReadonlyArray<Wallet>;

    allByPublicKey(): ReadonlyArray<Wallet>;

    allByUsername(): ReadonlyArray<Wallet>;

    allByIndex(indexName: string): ReadonlyArray<Wallet>;

    findByAddress(address: string): Wallet;

    has(key: string): boolean;

    hasByIndex(indexName: string, key: string): boolean;

    getIndexNames(): string[];

    findByPublicKey(publicKey: string): Wallet;

    findByUsername(username: string): Wallet;

    findByIndex(index: string, key: string): Wallet;

    findByIndexes(indexes: string[], key: string): Wallet;

    getNonce(publicKey: string): Utils.BigNumber;

    index(wallet: Wallet, blockchainWallet?: Wallet): void;

    setOnIndex(index: string, key: string, wallet: Wallet): void;

    forgetOnIndex(index: string, key: string): void;

    hasByAddress(address: string): boolean;

    hasByPublicKey(publicKey: string): boolean;

    hasByUsername(username: string): boolean;

    cloneWallet(origin: WalletRepository, wallet: Wallet): Wallet;

    updateWalletRanks(): void;
}

export enum SearchScope {
    Wallets,
    BlockProducers,
    Entities,
}

export interface SearchContext<T = any> {
    query: Record<string, string[]>;
    entries: ReadonlyArray<T>;
    defaultOrder: string[];
}

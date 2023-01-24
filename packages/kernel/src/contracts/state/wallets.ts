import { Utils } from "@solar-network/crypto";

export interface WalletBasic {
    address: string;
    publicKeys: Record<string, string | WalletPermissions>;
    balance: Utils.BigNumber;
    nonce: Utils.BigNumber;
    attributes: Record<string, any>;
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

    getNonce(): Utils.BigNumber;

    setNonce(nonce: Utils.BigNumber): void;

    increaseBalance(balance: Utils.BigNumber): Wallet;

    decreaseBalance(balance: Utils.BigNumber): Wallet;

    increaseNonce(): void;

    decreaseNonce(): void;

    getData(): WalletData;

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
    isDelegate(): boolean;

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    hasVoted(): boolean;

    /**
     * @param {string} delegate
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    getVoteBalance(delegate: string): Utils.BigNumber;

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
        delegates?: Map<string, number>,
    ): Map<string, Record<string, Utils.BigNumber>>;

    getBasicWallet();
}

export type WalletFactory = (address: string) => Wallet;

export interface WalletDelegateAttributes {
    username: string;
    voteBalance: Utils.BigNumber;
    voters: number;
    forgedFees: Utils.BigNumber;
    burnedFees: Utils.BigNumber;
    forgedRewards: Utils.BigNumber;
    donations: Utils.BigNumber;
    producedBlocks: number;
    rank?: number;
    lastBlock?: string;
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
}

export enum SearchScope {
    Wallets,
    Delegates,
    Entities,
}

export interface SearchContext<T = any> {
    query: Record<string, string[]>;
    entries: ReadonlyArray<T>;
    defaultOrder: string[];
}

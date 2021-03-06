import { Interfaces, Utils } from "@solar-network/crypto";

// todo: review all interfaces in here and document them properly. Remove ones that are no longer needed.

export interface WalletIndex {
    readonly indexer: WalletIndexer;
    readonly autoIndex: boolean;
    index(wallet: Wallet): void;
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

export type WalletIndexer = (index: WalletIndex, wallet: Wallet) => void;

export type WalletIndexerIndex = { name: string; indexer: WalletIndexer; autoIndex: boolean };

export enum WalletIndexes {
    Addresses = "addresses",
    PublicKeys = "publicKeys",
    Usernames = "usernames",
    Resignations = "resignations",
    Locks = "locks",
    Ipfs = "ipfs",
    Businesses = "businesses",
    BridgeChains = "bridgechains",
}

export interface WalletData {
    address: string;
    publicKey?: string;
    balance: Utils.BigNumber;
    nonce: Utils.BigNumber;
    attributes: Record<string, any>;
}

export interface Wallet {
    getAddress(): string;

    getPublicKey(): string | undefined;

    setPublicKey(publicKey: string): void;

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
     * @returns {Record<string, any[]>}
     * @memberof Wallet
     */
    getAllStateHistory(): Record<string, any[]>;

    /**
     * @param {string} key
     * @returns {any}
     * @memberof Wallet
     */
    getCurrentStateHistory(key: string): any;

    /**
     * @param {string} key
     * @returns {any}
     * @memberof Wallet
     */
    getPreviousStateHistory(key: string): any;

    /**
     * @param {string} key
     * @returns {any}
     * @memberof Wallet
     */
    getStateHistory(key: string): any;

    /**
     * @param {Record<string, any[]>} stateHistory
     * @memberof Wallet
     */
    setAllStateHistory(stateHistory: Record<string, any[]>): void;

    /**
     * @param {string} key
     * @memberof Wallet
     */
    initialiseStateHistory(key: string): void;

    /**
     * @param {string} key
     * @memberof Wallet
     */
    forgetStateHistory(key: string): void;

    /**
     * @param {string} key
     * @param {any} value
     * @param {Interfaces.ITransactionData | undefined} transaction
     * @memberof Wallet
     */
    addStateHistory(key: string, value?: any, transaction?: Interfaces.ITransactionData | undefined): void;

    /**
     * @param {string} key
     * @memberof Wallet
     */
    removeCurrentStateHistory(key: string): void;

    /**
     * @param {string} delegate
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    getVoteBalance(delegate: string): Utils.BigNumber;

    /**
     * @returns {Record<string, Utils.BigNumber>}
     * @memberof Wallet
     */
    getVoteBalances(): Record<string, Utils.BigNumber>;

    /**
     * @param {object} balances
     * @memberof Wallet
     */
    setVoteBalances(balances: object): void;

    /**
     * @returns {Record<string, WalletVoteDistribution>}
     * @memberof Wallet
     */
    getVoteDistribution(): Record<string, WalletVoteDistribution>;

    /**
     * @param {object} value
     * @param {Interfaces.ITransactionData} transaction
     * @memberof Wallet
     */
    changeVotes(value: object, transaction: Interfaces.ITransactionData): void;

    updateVoteBalances(): void;

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    hasSecondSignature(): boolean;

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    hasMultiSignature(): boolean;

    /**
     * @returns {Wallet}
     * @memberof Wallet
     */
    clone(): Wallet;

    calculateVoteAmount(
        balances: { [delegate: string]: Utils.BigNumber },
        delegates?: Record<string, number>,
    ): Record<string, any>;
}

export type WalletFactory = (address: string) => Wallet;

export interface WalletDelegateAttributes {
    username: string;
    voteBalance: Utils.BigNumber;
    voters: number;
    forgedFees: Utils.BigNumber;
    burnedFees: Utils.BigNumber;
    forgedRewards: Utils.BigNumber;
    devFunds: Utils.BigNumber;
    producedBlocks: number;
    rank?: number;
    lastBlock?: string;
    round?: number;
    resigned?: boolean;
    version?: string;
}

export type WalletMultiSignatureAttributes = Interfaces.IMultiSignatureAsset & { legacy?: boolean };

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

    index(wallet: Wallet): void;

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
    Locks,
    Entities,
}

export interface SearchContext<T = any> {
    query: Record<string, string[]>;
    entries: ReadonlyArray<T>;
    defaultOrder: string[];
}

export interface UnwrappedHtlcLock {
    lockId: string;
    senderPublicKey: string;
    amount: Utils.BigNumber;
    recipientId: string;
    secretHash: string;
    timestamp: number;
    expirationType: number;
    expirationValue: number;
    isExpired: boolean;
    memo: string;
}

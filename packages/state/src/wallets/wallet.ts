import { Enums, Interfaces, Utils } from "@solar-network/crypto";
import { Contracts, Enums as AppEnums, Services, Utils as AppUtils } from "@solar-network/kernel";

export class Wallet implements Contracts.State.Wallet {
    protected publicKeys: Record<string, string | Contracts.State.WalletPermissions> = {};
    protected balance: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected nonce: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected rank: number | undefined;
    protected transactions: Contracts.State.WalletTransactions = { received: { total: 0 }, sent: { total: 0 } };
    protected voteBalances: Map<string, Utils.BigNumber> = new Map();

    public constructor(
        protected readonly address: string,
        protected readonly attributes: Services.Attributes.AttributeMap,
        protected readonly isClone: boolean,
        protected readonly events?: Contracts.Kernel.EventDispatcher,
    ) {
        if (!this.hasAttribute("votes") && !isClone) {
            this.setAttribute("hidden.previousVotes", new Map());
            this.setAttribute("votes", new Map());
        }
    }

    public getAddress(): string {
        return this.address;
    }

    public getPublicKey(type: string): string | undefined {
        return this.publicKeys[type] as string;
    }

    public getPublicKeys(): Record<string, string | Contracts.State.WalletPermissions> {
        return this.publicKeys;
    }

    public hasPublicKeyByType(type: string): boolean {
        return this.publicKeys[type] !== undefined;
    }

    public hasPublicKey(publicKey: string): boolean {
        return Object.values(this.publicKeys).some((key) => {
            if (typeof key === "string") {
                return key === publicKey;
            } else {
                return Object.keys(key).includes(publicKey);
            }
        });
    }

    public forgetPublicKey(type: string): void {
        const previousValue = AppUtils.cloneDeep(this.publicKeys);

        delete this.publicKeys[type];

        this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
            key: "publicKeys",
            value: this.publicKeys,
            previousValue,
            wallet: this,
        });
    }

    public setPublicKey(publicKey: string, type: string, permissions?: Contracts.State.WalletPermissions): void {
        if (permissions === undefined && this.hasPublicKeyByType(type)) {
            return;
        }

        if (!this.hasPublicKey(publicKey)) {
            const previousValue = AppUtils.cloneDeep(this.publicKeys);

            if (permissions === undefined) {
                this.publicKeys[type] = publicKey;
            } else {
                if (!this.publicKeys[type]) {
                    this.publicKeys[type] = {};
                }
                this.publicKeys[type][publicKey] = permissions;
            }

            this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
                key: "publicKeys",
                value: this.publicKeys,
                previousValue,
                wallet: this,
            });
        }
    }

    public setPublicKeys(publicKeys: Record<string, string | Contracts.State.WalletPermissions>) {
        this.publicKeys = publicKeys;
    }

    public getBalance(): Utils.BigNumber {
        return this.balance;
    }

    public setBalance(balance: Utils.BigNumber): void {
        const previousValue = this.balance;

        this.balance = balance;

        this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
            key: "balance",
            value: balance,
            previousValue,
            wallet: this,
        });
    }

    public getRank(): number | undefined {
        return this.rank;
    }

    public setRank(rank: number) {
        if (rank > 0) {
            if (this.rank !== rank) {
                this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
                    key: "rank",
                    value: rank,
                    previousValue: this.rank,
                    wallet: this,
                });
                this.rank = rank;
            }
        } else {
            this.rank = undefined;
        }
    }

    public getNonce(): Utils.BigNumber {
        return this.nonce;
    }

    public setNonce(nonce: Utils.BigNumber): void {
        const previousValue = this.nonce;

        this.nonce = nonce;

        this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
            key: "nonce",
            value: nonce,
            previousValue,
            wallet: this,
        });
    }

    public increaseBalance(balance: Utils.BigNumber): Contracts.State.Wallet {
        this.setBalance(this.balance.plus(balance));

        return this;
    }

    public decreaseBalance(balance: Utils.BigNumber): Contracts.State.Wallet {
        this.setBalance(this.balance.minus(balance));

        return this;
    }

    public increaseNonce(): void {
        this.setNonce(this.nonce.plus(Utils.BigNumber.ONE));
    }

    public decreaseNonce(): void {
        this.setNonce(this.nonce.minus(Utils.BigNumber.ONE));
    }

    public increaseReceivedTransactions(newTransactionData: Interfaces.ITransactionData): void {
        this.increaseTransactions("received", newTransactionData);
    }

    public decreaseReceivedTransactions(
        oldTransactionData: Interfaces.ITransactionData,
        previousTransactionData?: Interfaces.ITransactionData,
    ): void {
        this.decreaseTransactions("received", oldTransactionData, previousTransactionData);
    }

    public increaseSentTransactions(newTransactionData: Interfaces.ITransactionData): void {
        this.increaseTransactions("sent", newTransactionData);
    }

    public decreaseSentTransactions(
        oldTransactionData: Interfaces.ITransactionData,
        previousTransactionData?: Interfaces.ITransactionData,
    ): void {
        this.decreaseTransactions("sent", oldTransactionData, previousTransactionData);
    }

    public getTransactions(): Contracts.State.WalletTransactions {
        return this.transactions;
    }

    public setTransactions(transactions: Contracts.State.WalletTransactions): void {
        this.transactions = transactions;
    }

    public getData(): Contracts.State.WalletData {
        return {
            address: this.address,
            publicKey: this.getPublicKey("primary")!,
            balance: this.balance,
            nonce: this.nonce,
            attributes: this.attributes,
        };
    }

    /**
     * @returns {number}
     * @memberof Wallet
     */
    public countAttributes(): number {
        return Object.keys(this.getAttributes()).length;
    }

    /**
     * @returns {Record<string, any>}
     * @memberof Wallet
     */
    public getAttributes(): Record<string, any> {
        return this.attributes.all();
    }

    /**
     * @template T
     * @param {string} key
     * @param {T} [defaultValue]
     * @returns {T}
     * @memberof Wallet
     */
    public getAttribute<T>(key: string, defaultValue?: T): T {
        return this.attributes.get<T>(key, defaultValue);
    }

    /**
     * @template T
     * @param {string} key
     * @param {T} value
     * @returns {boolean}
     * @memberof Wallet
     */
    public setAttribute<T = any>(key: string, value: T): boolean {
        const na = Symbol();
        const previousValue = this.attributes.get(key, na);
        const wasSet = this.attributes.set<T>(key, value);

        if (!key.startsWith("hidden.")) {
            this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
                key,
                value,
                previousValue: previousValue === na ? undefined : previousValue,
                wallet: this,
            });
        }
        return wasSet;
    }

    /**
     * @param {string} key
     * @returns {boolean}
     * @memberof Wallet
     */
    public forgetAttribute(key: string): boolean {
        const na = Symbol();
        const previousValue = this.attributes.get(key, na);
        const wasSet = this.attributes.forget(key);

        if (!key.startsWith("hidden.")) {
            this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
                key,
                previousValue: previousValue === na ? undefined : previousValue,
                wallet: this,
            });
        }
        return wasSet;
    }

    /**
     * @param {string} key
     * @returns {boolean}
     * @memberof Wallet
     */
    public hasAttribute(key: string): boolean {
        return this.attributes.has(key);
    }

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    public isBlockProducer(): boolean {
        return this.hasAttribute("blockProducer");
    }

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    public hasVoted(): boolean {
        const votes: Map<string, Utils.BigNumber> = this.getAttribute("votes");
        return votes.size > 0;
    }

    /**
     * @param {string} blockProducer
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    public getVoteBalance(blockProducer: string): Utils.BigNumber {
        return this.voteBalances.get(blockProducer) ?? Utils.BigNumber.ZERO;
    }

    /**
     * @returns {Map<string, Utils.BigNumber>}
     * @memberof Wallet
     */
    public getVoteBalances(): Map<string, Utils.BigNumber> {
        return this.voteBalances;
    }

    public setVoteBalances(balances: Map<string, Utils.BigNumber>) {
        this.voteBalances = balances;
    }

    /**
     * @returns {Map<string, Contracts.State.WalletVoteDistribution>}
     * @memberof Wallet
     */
    public getVoteDistribution(): Map<string, Contracts.State.WalletVoteDistribution> {
        const balances: Map<string, Utils.BigNumber> = this.voteBalances;
        const votes: Map<string, number> = this.getAttribute("votes");

        const distribution: Map<string, Contracts.State.WalletVoteDistribution> = new Map();

        for (const [username, percent] of votes.entries()) {
            distribution.set(username, { percent, votes: balances.get(username)! });
        }

        return distribution;
    }

    public updateVoteBalances(): void {
        const votes: Map<string, number> = this.getAttribute("votes");
        this.voteBalances = new Map();

        const voteAmounts = this.calculateVoteAmount({
            balance: this.getBalance(),
        });

        for (const blockProducer of votes.keys()) {
            const voteAmount = voteAmounts.get(blockProducer)!;
            this.setVoteBalance(blockProducer, Utils.BigNumber.make(voteAmount.balance));
        }
    }

    /**
     * @returns {Contracts.State.Wallet}
     * @memberof Wallet
     */
    public clone(): Contracts.State.Wallet {
        const cloned = new Wallet(this.address, this.attributes.clone(), true);
        cloned.publicKeys = AppUtils.cloneDeep(this.publicKeys);
        cloned.balance = this.balance;
        cloned.nonce = this.nonce;
        cloned.rank = this.rank;
        cloned.transactions = AppUtils.cloneDeep(this.transactions);
        cloned.voteBalances = AppUtils.cloneDeep(this.voteBalances);
        return cloned;
    }

    /**
     * @returns {Map<string, Record<string, Utils.BigNumber>>}
     * @memberof Wallet
     */
    public calculateVoteAmount(
        balances: { balance: Utils.BigNumber },
        blockProducers?: Map<string, number>,
    ): Map<string, Record<string, Utils.BigNumber>> {
        if (!blockProducers) {
            blockProducers = this.getAttribute("votes")!;
        }

        const remainders: Map<string, Utils.BigNumber> = new Map();
        const votes: Map<string, Record<string, Utils.BigNumber>> = new Map();

        for (const [blockProducer, percent] of blockProducers.entries()) {
            votes.set(blockProducer, {});
            for (const [key, value] of Object.entries(balances)) {
                votes.get(blockProducer)![key] = value.times(Math.round(percent * 100)).dividedBy(10000);
            }
        }

        for (const vote of votes.values()) {
            for (const [key, value] of Object.entries(vote)) {
                if (!remainders.has(key)) {
                    remainders.set(key, Utils.BigNumber.make(balances[key]));
                }
                remainders.set(key, remainders.get(key)!.minus(value));
            }
        }

        const keys = [...votes.keys()];

        for (const [key, value] of remainders.entries()) {
            for (let i = 0; i < value.toBigInt(); i++) {
                const mapValue: Record<string, Utils.BigNumber> = votes.get(keys[i])!;
                mapValue[key] = mapValue[key].plus(1);
            }
        }

        return votes;
    }

    public getBasicWallet(): Contracts.State.WalletBasic {
        const attributes: Record<string, any> = AppUtils.cloneDeep(this.getAttributes());

        if (this.hasAttribute("blockProducer.resignation")) {
            switch (this.getAttribute("blockProducer.resignation")) {
                case Enums.BlockProducerStatus.PermanentResign: {
                    attributes.blockProducer.resignation = "permanent";
                    break;
                }
                case Enums.BlockProducerStatus.TemporaryResign: {
                    attributes.blockProducer.resignation = "temporary";
                    break;
                }
            }
        }

        if (attributes.blockProducer && !isNaN(attributes.blockProducer.round)) {
            delete attributes.blockProducer.round;
        }

        delete attributes.hidden;

        return {
            address: this.getAddress(),
            publicKeys: this.getPublicKeys(),
            balance: this.getBalance(),
            rank: this.getRank(),
            nonce: this.getNonce(),
            attributes: { ...attributes, votes: undefined },
            transactions: this.getTransactions(),
            votingFor: Object.fromEntries(this.getVoteDistribution().entries()),
        };
    }

    public toBSON() {
        return this.getBasicWallet();
    }

    public toJSON() {
        return this.getBasicWallet();
    }

    private increaseTransactions(action: "received" | "sent", newTransactionData: Interfaces.ITransactionData): void {
        const previousValue = AppUtils.cloneDeep(this.transactions);

        this.transactions[action].total++;
        const { type } = newTransactionData;
        const actionObject = this.transactions[action];
        if (!actionObject.types) {
            actionObject.types = {};
        }

        if (!actionObject.types[type]) {
            actionObject.types[type] = {
                count: 0,
            };
        }

        const typeObject = actionObject.types[type];
        typeObject.count++;
        const timestamp =
            newTransactionData.timestamp !== undefined
                ? AppUtils.formatTimestamp(newTransactionData.timestamp)
                : undefined;
        typeObject.last = { id: newTransactionData.id!, timestamp };
        if (!typeObject.first) {
            typeObject.first = { id: newTransactionData.id!, timestamp };
        }

        this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
            key: "transactions",
            value: this.transactions,
            previousValue,
            wallet: this,
        });
    }

    private decreaseTransactions(
        action: "received" | "sent",
        oldTransactionData: Interfaces.ITransactionData,
        previousTransactionData?: Interfaces.ITransactionData,
    ): void {
        const previousValue = AppUtils.cloneDeep(this.transactions);

        this.transactions[action].total--;
        const { type } = oldTransactionData;

        const typeObject = this.transactions[action].types?.[type];

        if (typeObject) {
            typeObject.count--;

            if (previousTransactionData) {
                typeObject.last = {
                    id: previousTransactionData.id!,
                    timestamp:
                        previousTransactionData.timestamp !== undefined
                            ? AppUtils.formatTimestamp(previousTransactionData.timestamp)
                            : undefined,
                };
            } else {
                delete this.transactions[action].types![type];
            }

            if (Object.keys(this.transactions[action].types!).length === 0) {
                delete this.transactions[action].types;
            }
        }

        this.events?.dispatchSync(AppEnums.WalletEvent.PropertySet, {
            key: "transactions",
            value: this.transactions,
            previousValue,
            wallet: this,
        });
    }

    private setVoteBalance(blockProducer: string, balance: Utils.BigNumber) {
        this.voteBalances.set(blockProducer, balance);
    }
}

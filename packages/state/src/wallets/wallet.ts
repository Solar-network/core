import { Interfaces, Utils } from "@solar-network/crypto";
import { Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { WalletEvent } from "./wallet-event";

export class Wallet implements Contracts.State.Wallet {
    protected publicKey: string | undefined;
    protected balance: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected nonce: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected stateHistory: Record<string, any[]> = {};
    protected voteBalances: Record<string, Utils.BigNumber> = {};

    public constructor(
        protected readonly address: string,
        protected readonly attributes: Services.Attributes.AttributeMap,
        protected readonly isClone: boolean,
        protected readonly events?: Contracts.Kernel.EventDispatcher,
    ) {
        if (!this.getStateHistory("votes") && !isClone) {
            this.initialiseStateHistory("votes");
            this.addStateHistory("votes", {});
        }

        if (!this.hasAttribute("votes") && !isClone) {
            this.setAttribute("votes", this.getCurrentStateHistory("votes").value);
        }
    }

    public getAddress(): string {
        return this.address;
    }

    public getPublicKey(): string | undefined {
        return this.publicKey;
    }

    public hasPublicKey(): boolean {
        return this.publicKey !== undefined;
    }

    public forgetPublicKey(): void {
        const previousValue = this.publicKey;

        this.publicKey = undefined;

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
            key: "publicKey",
            previousValue,
            wallet: this,
        });
    }

    public setPublicKey(publicKey: string): void {
        const previousValue = this.publicKey;

        this.publicKey = publicKey;

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
            key: "publicKey",
            value: publicKey,
            previousValue,
            wallet: this,
        });
    }

    public getBalance(): Utils.BigNumber {
        return this.balance;
    }

    public setBalance(balance: Utils.BigNumber): void {
        const previousValue = this.balance;

        this.balance = balance;

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
            key: "balance",
            value: balance,
            previousValue,
            wallet: this,
        });
    }

    public getNonce(): Utils.BigNumber {
        return this.nonce;
    }

    public setNonce(nonce: Utils.BigNumber): void {
        const previousValue = this.nonce;

        this.nonce = nonce;

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
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

    public getData(): Contracts.State.WalletData {
        return {
            address: this.address,
            publicKey: this.publicKey,
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
        const wasSet = this.attributes.set<T>(key, value);

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
            key: key,
            value,
            wallet: this,
        });

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

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.publicKey,
            key,
            previousValue: previousValue === na ? undefined : previousValue,
            wallet: this,
        });

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
    public isDelegate(): boolean {
        return this.hasAttribute("delegate");
    }

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    public hasVoted(): boolean {
        return Object.keys(this.getAttribute("votes")).length > 0;
    }

    /**
     * @returns {Record<string, any[]>}
     * @memberof Wallet
     */
    public getAllStateHistory(): Record<string, any[]> {
        return this.stateHistory;
    }

    /**
     * @returns {any}
     * @memberof Wallet
     */
    public getCurrentStateHistory(key: string): any {
        return this.stateHistory[key].at(-1);
    }

    /**
     * @returns {any}
     * @memberof Wallet
     */
    public getPreviousStateHistory(key: string): any {
        return this.stateHistory[key].at(-2) || { value: {} };
    }

    /**
     * @returns {any}
     * @memberof Wallet
     */
    public getStateHistory(key: string): any {
        return this.stateHistory[key];
    }

    public setAllStateHistory(stateHistory: Record<string, any[]>): void {
        this.stateHistory = stateHistory;
    }

    public initialiseStateHistory(key: string): void {
        this.stateHistory[key] = [];
    }

    public forgetStateHistory(key: string): void {
        delete this.stateHistory[key];
    }

    public addStateHistory(key: string, value?: any, transaction?: Interfaces.ITransactionData | undefined): void {
        this.stateHistory[key].push({
            value,
            transaction: transaction ? { height: transaction.blockHeight, id: transaction.id } : undefined,
        });
    }

    public removeCurrentStateHistory(key: string): void {
        if (this.stateHistory[key].length > 1) {
            this.stateHistory[key].pop();
        }
    }

    /**
     * @param {string} delegate
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    public getVoteBalance(delegate: string): Utils.BigNumber {
        return this.voteBalances[delegate] ?? Utils.BigNumber.ZERO;
    }

    /**
     * @returns {Record<string, Utils.BigNumber>}
     * @memberof Wallet
     */
    public getVoteBalances(): Record<string, Utils.BigNumber> {
        return this.voteBalances;
    }

    public setVoteBalances(balances: Record<string, Utils.BigNumber>) {
        this.voteBalances = balances;
    }

    /**
     * @returns {Record<string, Contracts.State.WalletVoteDistribution>}
     * @memberof Wallet
     */
    public getVoteDistribution(): Record<string, Contracts.State.WalletVoteDistribution> {
        const balances: object = this.voteBalances;
        const votes: object = this.getAttribute("votes");

        const distribution: Record<string, Contracts.State.WalletVoteDistribution> = {};

        for (const username of Object.keys(votes)) {
            distribution[username] = { percent: votes[username], votes: balances[username] };
        }

        return distribution;
    }

    /**
     * @param {object} value
     * @memberof Wallet
     */
    public changeVotes(value: Record<string, number>, transaction: Interfaces.ITransactionData): void {
        const sortedVotes: Record<string, number> = Utils.sortVotes(value);
        this.addStateHistory("votes", sortedVotes, transaction);
        this.setAttribute("votes", sortedVotes);
    }

    public updateVoteBalances(): void {
        const votes: Record<string, number> = this.getAttribute("votes");
        this.voteBalances = {};

        const voteAmounts = this.calculateVoteAmount({
            balance: this.getBalance(),
            lockedBalance: this.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO),
        });

        for (const delegate of Object.keys(votes)) {
            this.setVoteBalance(
                delegate,
                Utils.BigNumber.make(voteAmounts[delegate].balance).plus(voteAmounts[delegate].lockedBalance),
            );
        }
    }

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    public hasSecondSignature(): boolean {
        return this.hasAttribute("secondPublicKey");
    }

    /**
     * @returns {boolean}
     * @memberof Wallet
     */
    public hasMultiSignature(): boolean {
        return this.hasAttribute("multiSignature");
    }

    /**
     * @returns {Contracts.State.Wallet}
     * @memberof Wallet
     */
    public clone(): Contracts.State.Wallet {
        const cloned = new Wallet(this.address, this.attributes.clone(), true);
        cloned.publicKey = this.publicKey;
        cloned.balance = this.balance;
        cloned.nonce = this.nonce;
        cloned.stateHistory = AppUtils.cloneDeep(this.stateHistory);
        cloned.voteBalances = AppUtils.cloneDeep(this.voteBalances);
        return cloned;
    }

    /**
     * @returns {Record<string, any>}
     * @memberof Wallet
     */
    public calculateVoteAmount(
        balances: Record<string, Utils.BigNumber>,
        delegates?: Record<string, number>,
    ): Record<string, any> {
        if (!delegates) {
            delegates = this.getAttribute("votes") as Record<string, number>;
        }

        const remainders: { [key: string]: Utils.BigNumber } = {};
        const votes: { [delegate: string]: object } = {};

        for (const [delegate, percent] of Object.entries(delegates)) {
            votes[delegate] = {};
            for (const [key, value] of Object.entries(balances)) {
                votes[delegate][key] = value.times(Math.round(percent * 100)).dividedBy(10000);
            }
        }

        for (const vote of Object.values(votes)) {
            for (const [key, value] of Object.entries(vote)) {
                if (remainders[key] === undefined) {
                    remainders[key] = Utils.BigNumber.make(balances[key]);
                }
                remainders[key] = remainders[key].minus(value);
            }
        }

        const keys = Object.keys(votes);

        for (const [key, value] of Object.entries(remainders)) {
            for (let i = 0; i < value.toBigInt(); i++) {
                votes[keys[i]][key] = votes[keys[i]][key].plus(1);
            }
        }

        return votes;
    }

    private setVoteBalance(delegate: string, balance: Utils.BigNumber) {
        this.voteBalances[delegate] = balance;
    }
}

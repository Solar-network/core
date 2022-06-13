import { Contracts, Services } from "@solar-network/core-kernel";
import { Utils } from "@solar-network/crypto";

import { WalletEvent } from "./wallet-event";

export class Wallet implements Contracts.State.Wallet {
    protected publicKey: string | undefined;
    protected balance: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected nonce: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected voteBalances: object = {};
    protected votes: object[] = [{}];

    public constructor(
        protected readonly address: string,
        protected readonly attributes: Services.Attributes.AttributeMap,
        protected readonly events?: Contracts.Kernel.EventDispatcher,
    ) {
        if (!this.hasAttribute("votes")) {
            this.setAttribute("votes", this.votes.at(-1));
        }
    }

    public getAddress(): string {
        return this.address;
    }

    public getPublicKey(): string | undefined {
        return this.publicKey;
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
     * @returns {object[]}
     * @memberof Wallet
     */
    public getVotes(): object[] {
        return this.votes;
    }

    public setVotes(votes: object[]): void {
        this.votes = votes;
    }

    /**
     * @param {string} delegate
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    public getVoteBalance(delegate: string): Utils.BigNumber {
        return this.voteBalances[delegate];
    }

    /**
     * @returns {object}
     * @memberof Wallet
     */
    public getVoteBalances(): object {
        return this.voteBalances;
    }

    public setVoteBalances(balances: object) {
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
    public changeVotes(value: Record<string, number>): void {
        const sortedVotes: Record<string, number> = Utils.sortVotes(value);
        this.votes.push(sortedVotes);
        this.setAttribute("votes", sortedVotes);
    }

    public updateVoteBalances(): void {
        const votes: Record<string, number> = this.getAttribute("votes");
        this.voteBalances = {};

        const voteAmounts = this.calculateVoteAmount({
            balance: this.getBalance() || Utils.BigNumber.ZERO,
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
        const cloned = new Wallet(this.address, this.attributes.clone());
        cloned.publicKey = this.publicKey;
        cloned.balance = this.balance;
        cloned.nonce = this.nonce;
        cloned.voteBalances = { ...this.voteBalances };
        cloned.votes = this.votes.map((vote) => {
            return { ...vote };
        });
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

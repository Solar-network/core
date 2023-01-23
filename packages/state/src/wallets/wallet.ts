import { Enums, Utils } from "@solar-network/crypto";
import { Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { WalletEvent } from "./wallet-event";

export class Wallet implements Contracts.State.Wallet {
    protected publicKey: string | undefined;
    protected balance: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected nonce: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected voteBalances: Map<string, Utils.BigNumber> = new Map();

    public constructor(
        protected readonly address: string,
        protected readonly attributes: Services.Attributes.AttributeMap,
        protected readonly isClone: boolean,
        protected readonly events?: Contracts.Kernel.EventDispatcher,
    ) {
        if (!this.hasAttribute("votes") && !isClone) {
            this.setAttribute("votes", new Map());
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
        return this.hasAttribute("delegate.username");
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
     * @param {string} delegate
     * @returns {Utils.BigNumber}
     * @memberof Wallet
     */
    public getVoteBalance(delegate: string): Utils.BigNumber {
        return this.voteBalances.get(delegate) ?? Utils.BigNumber.ZERO;
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
            lockedBalance: this.getAttribute("htlc.lockedBalance", Utils.BigNumber.ZERO),
        });

        for (const delegate of votes.keys()) {
            const voteAmount = voteAmounts.get(delegate)!;
            this.setVoteBalance(delegate, Utils.BigNumber.make(voteAmount.balance).plus(voteAmount.lockedBalance));
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
        cloned.voteBalances = AppUtils.cloneDeep(this.voteBalances);
        return cloned;
    }

    /**
     * @returns {Map<string, Record<string, Utils.BigNumber>>}
     * @memberof Wallet
     */
    public calculateVoteAmount(
        balances: { balance: Utils.BigNumber; lockedBalance: Utils.BigNumber },
        delegates?: Map<string, number>,
    ): Map<string, Record<string, Utils.BigNumber>> {
        if (!delegates) {
            delegates = this.getAttribute("votes")!;
        }

        const remainders: Map<string, Utils.BigNumber> = new Map();
        const votes: Map<string, Record<string, Utils.BigNumber>> = new Map();

        for (const [delegate, percent] of delegates.entries()) {
            votes.set(delegate, {});
            for (const [key, value] of Object.entries(balances)) {
                votes.get(delegate)![key] = value.times(Math.round(percent * 100)).dividedBy(10000);
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

        let resigned: string | undefined = undefined;
        if (this.hasAttribute("delegate.resigned")) {
            switch (this.getAttribute("delegate.resigned")) {
                case Enums.DelegateStatus.PermanentResign: {
                    resigned = "permanent";
                    break;
                }
                case Enums.DelegateStatus.TemporaryResign: {
                    resigned = "temporary";
                    break;
                }
            }
            attributes.delegate.resigned = resigned;
        }

        if (attributes.delegate && !isNaN(attributes.delegate.round)) {
            delete attributes.delegate.round;
        }

        return {
            address: this.getAddress(),
            publicKey: this.getPublicKey(),
            balance: this.getBalance(),
            nonce: this.getNonce(),
            attributes: { ...attributes, votes: undefined },
            votingFor: Object.fromEntries(this.getVoteDistribution().entries()),
        };
    }

    public toBSON() {
        return this.getBasicWallet();
    }

    public toJSON() {
        return this.getBasicWallet();
    }

    private setVoteBalance(delegate: string, balance: Utils.BigNumber) {
        this.voteBalances.set(delegate, balance);
    }
}

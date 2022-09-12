import { Enums, Utils } from "@solar-network/crypto";
import { Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";

import { WalletEvent } from "./wallet-event";

export class Wallet implements Contracts.State.Wallet {
    protected publicKeys: Record<string, string | Contracts.State.WalletPermissions> = {};
    protected balance: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected nonce: Utils.BigNumber = Utils.BigNumber.ZERO;
    protected voteBalances: Record<string, Utils.BigNumber> = {};

    public constructor(
        protected readonly address: string,
        protected readonly attributes: Services.Attributes.AttributeMap,
        protected readonly isClone: boolean,
        protected readonly events?: Contracts.Kernel.EventDispatcher,
    ) {
        if (!this.hasAttribute("votes") && !isClone) {
            this.setAttribute("votes", {});
        }
    }

    public getAddress(): string {
        return this.address;
    }

    public getPublicKey(type: string): string {
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
        delete this.publicKeys[type];
    }

    public setPublicKey(publicKey: string, type: string, permissions?: Contracts.State.WalletPermissions): void {
        if (permissions === undefined && this.hasPublicKeyByType(type)) {
            return;
        }

        if (!this.hasPublicKey(publicKey)) {
            if (permissions === undefined) {
                this.publicKeys[type] = publicKey;
            } else {
                if (!this.publicKeys[type]) {
                    this.publicKeys[type] = {};
                }
                this.publicKeys[type][publicKey] = permissions;
            }
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

        this.events?.dispatchSync(WalletEvent.PropertySet, {
            publicKey: this.getPublicKey("primary"),
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
            publicKey: this.getPublicKey("primary"),
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
            publicKey: this.getPublicKey("primary"),
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
            publicKey: this.getPublicKey("primary"),
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
            publicKey: this.getPublicKey("primary"),
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
        return Object.keys(this.getAttribute("votes")).length > 0;
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
     * @returns {Contracts.State.Wallet}
     * @memberof Wallet
     */
    public clone(): Contracts.State.Wallet {
        const cloned = new Wallet(this.address, this.attributes.clone(), true);
        cloned.publicKeys = AppUtils.cloneDeep(this.publicKeys);
        cloned.balance = this.balance;
        cloned.nonce = this.nonce;
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
            publicKeys: this.getPublicKeys(),
            balance: this.getBalance(),
            nonce: this.getNonce(),
            attributes: { ...attributes, votes: undefined },
            votingFor: this.getVoteDistribution(),
        };
    }

    public toBSON() {
        return this.getBasicWallet();
    }

    public toJSON() {
        return this.getBasicWallet();
    }

    private setVoteBalance(delegate: string, balance: Utils.BigNumber) {
        this.voteBalances[delegate] = balance;
    }
}

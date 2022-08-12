import { Blocks, Crypto, Identities, Interfaces, Utils } from "@solar-network/crypto";
import { Utils as AppUtils } from "@solar-network/kernel";

import { Delegate as IDelegate } from "./interfaces";

/**
 * @export
 * @class Delegate
 */
export class Delegate implements IDelegate {
    /**
     * @type {Interfaces.IKeyPair}
     * @memberof Delegate
     */
    public keys: Interfaces.IKeyPair | undefined;

    /**
     * @type {string}
     * @memberof Delegate
     */
    public publicKey: string;

    /**
     * @type {string}
     * @memberof Delegate
     */
    public address: string;

    /**
     * @param {string} privateKey
     * @memberof Delegate
     */
    public constructor(privateKey: string) {
        this.keys = Identities.Keys.fromPrivateKey(privateKey);
        this.publicKey = this.keys.publicKey;
        this.address = Identities.Address.fromPublicKey(this.publicKey);
    }

    /**
     * @param {Interfaces.ITransactionData[]} transactions
     * @param {Record<string, any>} options
     * @returns {Interfaces.IBlock}
     * @memberof Delegate
     */
    public forge(transactions: Interfaces.ITransactionData[], options: Record<string, any>): Interfaces.IBlock {
        return this.createBlock(this.keys!, transactions, options);
    }

    protected createBlock(
        keys: Interfaces.IKeyPair,
        transactions: Interfaces.ITransactionData[],
        options: Record<string, any>,
    ): Interfaces.IBlock {
        if (!(transactions instanceof Array)) {
            transactions = [];
        }

        const totals: { amount: Utils.BigNumber; fee: Utils.BigNumber } = {
            amount: Utils.BigNumber.ZERO,
            fee: Utils.BigNumber.ZERO,
        };

        const payloadBuffers: Buffer[] = [];
        for (const transaction of transactions) {
            AppUtils.assert.defined<string>(transaction.id);

            totals.amount = totals.amount.plus(transaction.amount || Utils.BigNumber.ZERO);
            totals.fee = totals.fee.plus(transaction.fee);

            payloadBuffers.push(Buffer.from(transaction.id, "hex"));
        }

        return Blocks.BlockFactory.make(
            {
                version: 0,
                generatorPublicKey: keys.publicKey,
                timestamp: options.timestamp,
                previousBlock: options.previousBlock.id,
                height: options.previousBlock.height + 1,
                numberOfTransactions: transactions.length,
                totalAmount: totals.amount,
                totalFee: totals.fee,
                reward: options.reward,
                payloadLength: 32 * transactions.length,
                payloadHash: Crypto.HashAlgorithms.sha256(payloadBuffers).toString("hex"),
                transactions,
            },
            keys,
            options.aux,
        );
    }
}

import { Blocks, Crypto, Enums, Identities, Interfaces, Utils } from "@solar-network/crypto";
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
        this.publicKey = this.keys.publicKey.secp256k1;
        this.address = Identities.Address.fromPublicKey(this.publicKey);
    }

    /**
     * @param {Interfaces.ITransaction[]} transactions
     * @param {Record<string, any>} options
     * @returns {Interfaces.IBlock}
     * @memberof Delegate
     */
    public forge(transactions: Interfaces.ITransaction[], options: Record<string, any>): Interfaces.IBlock {
        return this.createBlock(this.keys!, transactions, options);
    }

    protected createBlock(
        keys: Interfaces.IKeyPair,
        transactions: Interfaces.ITransaction[],
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

            let amount: Utils.BigNumber = Utils.BigNumber.ZERO;
            switch (transaction.internalType) {
                case Enums.OtherType.Burn: {
                    amount = amount.plus(transaction.data.asset!.burn!.amount!);
                    break;
                }
                case Enums.TransferType.Single: {
                    amount = amount.plus(transaction.data.asset!.recipients![0].amount!);
                    break;
                }
            }
            totals.amount = totals.amount.plus(amount);
            totals.fee = totals.fee.plus(transaction.data.fee);

            payloadBuffers.push(Buffer.from(transaction.data.id!, "hex"));
        }

        return Blocks.BlockFactory.make(
            {
                version: 0,
                generatorPublicKey: keys.publicKey.secp256k1,
                timestamp: options.timestamp,
                previousBlock: options.previousBlock.id,
                height: options.previousBlock.height + 1,
                numberOfTransactions: transactions.length,
                totalAmount: totals.amount,
                totalFee: totals.fee,
                reward: options.reward,
                payloadLength: 32 * transactions.length,
                payloadHash: Crypto.HashAlgorithms.sha256(payloadBuffers).toString("hex"),
                transactions: transactions.map((transaction) => transaction.data),
            },
            keys,
            options.aux,
        );
    }
}

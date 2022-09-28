import { Enums, Interfaces, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class TransactionResource implements Resource {
    /**
     * @protected
     * @type {Contracts.State.WalletRepository}
     * @memberof TransactionResource
     */
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    protected readonly walletRepository!: Contracts.State.WalletRepository;

    /**
     * Return the raw representation of the resource.
     *
     * @param {Interfaces.ITransactionData} resource
     * @returns {object}
     * @memberof Resource
     */
    public raw(resource: Interfaces.ITransactionData): object {
        return JSON.parse(JSON.stringify(resource));
    }

    /**
     * Return the transformed representation of the resource.
     *
     * @param {Interfaces.ITransactionData} resource
     * @returns {object}
     * @memberof Resource
     */
    public transform(resource: Interfaces.ITransactionData): object {
        AppUtils.assert.defined<string>(resource.senderId);

        let amount: string | undefined =
            typeof resource.amount !== "undefined" && !resource.amount.isZero() ? resource.amount.toFixed() : undefined;

        if (
            resource.typeGroup === Enums.TransactionTypeGroup.Core &&
            resource.type === Enums.TransactionType.Core.Transfer
        ) {
            amount = resource
                .asset!.recipients!.reduce((sum, transfer) => sum.plus(transfer!.amount), Utils.BigNumber.ZERO)
                .toFixed();
        }

        return {
            id: resource.id,
            blockHeight: resource.blockHeight,
            blockId: resource.blockId,
            version: resource.version,
            type: resource.type,
            typeGroup: resource.typeGroup,
            amount,
            fee: resource.fee.toFixed(),
            burnedFee: typeof resource.burnedFee !== "undefined" ? resource.burnedFee.toFixed() : undefined,
            sender: resource.senderId,
            senderPublicKey: resource.senderPublicKey,
            recipient: resource.recipientId,
            signatures: resource.signatures,
            memo: resource.memo,
            asset: resource.asset,
            confirmations: 0,
            nonce: resource.nonce?.toFixed(),
        };
    }
}

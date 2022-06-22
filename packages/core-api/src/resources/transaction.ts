import { Container, Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { Enums, Interfaces, Utils } from "@solar-network/crypto";

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
        AppUtils.assert.defined<string>(resource.senderPublicKey);

        const sender: string = this.walletRepository.findByPublicKey(resource.senderPublicKey).getAddress();

        let amount: string | undefined =
            typeof resource.amount !== "undefined" && !resource.amount.isZero() ? resource.amount.toFixed() : undefined;

        if (
            resource.typeGroup === Enums.TransactionTypeGroup.Core &&
            resource.type === Enums.TransactionType.Core.Transfer
        ) {
            amount = resource
                .asset!.transfers!.reduce((sum, transfer) => sum.plus(transfer!.amount), Utils.BigNumber.ZERO)
                .toFixed();
        }

        return {
            id: resource.id,
            blockId: resource.blockId,
            version: resource.version,
            type: resource.type,
            typeGroup: resource.typeGroup,
            amount,
            fee: resource.fee.toFixed(),
            burnedFee: typeof resource.burnedFee !== "undefined" ? resource.burnedFee.toFixed() : undefined,
            sender,
            senderPublicKey: resource.senderPublicKey,
            recipient: resource.recipientId,
            signature: resource.signature,
            signSignature: resource.signSignature || resource.secondSignature,
            signatures: resource.signatures,
            memo: resource.memo,
            asset: resource.asset,
            confirmations: 0,
            timestamp:
                typeof resource.timestamp !== "undefined" ? AppUtils.formatTimestamp(resource.timestamp) : undefined,
            nonce: resource.nonce?.toFixed(),
        };
    }
}

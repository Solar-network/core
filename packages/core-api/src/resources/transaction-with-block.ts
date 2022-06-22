import { Container, Contracts, Utils as AppUtils } from "@solar-network/core-kernel";
import { Enums, Utils } from "@solar-network/crypto";

import { Resource } from "../interfaces";

@Container.injectable()
export class TransactionWithBlockResource implements Resource {
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    protected readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    public raw(resource: Contracts.Shared.TransactionDataWithBlockData): object {
        return JSON.parse(JSON.stringify(resource));
    }

    public transform(resource: Contracts.Shared.TransactionDataWithBlockData): object {
        const transactionData = resource.data;
        const blockData = resource.block;

        AppUtils.assert.defined<string>(transactionData.senderPublicKey);

        const sender: string = this.walletRepository.findByPublicKey(transactionData.senderPublicKey).getAddress();
        const signSignature: string | undefined = transactionData.signSignature ?? transactionData.secondSignature;
        const confirmations: number = this.stateStore.getLastHeight() - blockData.height + 1;

        let amount: string | undefined =
            typeof transactionData.amount !== "undefined" && !transactionData.amount.isZero()
                ? transactionData.amount.toFixed()
                : undefined;

        if (
            transactionData.typeGroup === Enums.TransactionTypeGroup.Core &&
            transactionData.type === Enums.TransactionType.Core.Transfer
        ) {
            amount = transactionData
                .asset!.transfers!.reduce((sum, transfer) => sum.plus(transfer!.amount), Utils.BigNumber.ZERO)
                .toFixed();
        }

        return {
            id: transactionData.id,
            blockId: transactionData.blockId,
            version: transactionData.version,
            type: transactionData.type,
            typeGroup: transactionData.typeGroup,
            amount,
            fee: transactionData.fee.toFixed(),
            burnedFee:
                typeof transactionData.burnedFee !== "undefined" ? transactionData.burnedFee.toFixed() : undefined,
            sender,
            senderPublicKey: transactionData.senderPublicKey,
            recipient: transactionData.recipientId,
            signature: transactionData.signature,
            signSignature,
            signatures: transactionData.signatures,
            memo: transactionData.memo,
            asset: transactionData.asset,
            confirmations,
            timestamp: AppUtils.formatTimestamp(blockData.timestamp),
            nonce: transactionData.nonce!.toFixed(),
        };
    }
}

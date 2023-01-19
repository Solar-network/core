import { Interfaces, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

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

        AppUtils.assert.defined<string>(transactionData.senderId);

        const confirmations: number = this.stateStore.getLastHeight() - blockData.height + 1;

        let amount: string | undefined =
            typeof transactionData.amount !== "undefined" && !transactionData.amount.isZero()
                ? transactionData.amount.toFixed()
                : undefined;

        const asset: Interfaces.ITransactionAsset | undefined = transactionData.asset;

        if (transactionData.type === "burn") {
            amount = asset!.burn!.amount.toFixed();
        }

        if (transactionData.type === "transfer") {
            amount = transactionData
                .asset!.recipients!.reduce((sum, transfer) => sum.plus(transfer!.amount), Utils.BigNumber.ZERO)
                .toFixed();
        }

        if (transactionData.type === "vote") {
            asset!.votes = Object.fromEntries(Object.entries(asset!.votes!).filter(([_, value]) => value !== 0));
            const firstKey = Object.keys(asset!.votes!)[0];
            if (firstKey?.length === 66) {
                asset!.votes = {
                    [this.walletRepository.findByPublicKey(firstKey).getAttribute("delegate.username")]: 100,
                };
            }
        }

        return {
            id: transactionData.id,
            blockHeight: transactionData.blockHeight,
            version: transactionData.version,
            type: transactionData.type,
            amount,
            fee: transactionData.fee.toFixed(),
            burnedFee:
                typeof transactionData.burnedFee !== "undefined" ? transactionData.burnedFee.toFixed() : undefined,
            sender: transactionData.senderId,
            senderPublicKey: transactionData.senderPublicKey,
            recipient: transactionData.recipientId,
            signatures: transactionData.signatures,
            memo: transactionData.memo,
            asset,
            confirmations,
            timestamp: AppUtils.formatTimestamp(blockData.timestamp),
            nonce: transactionData.nonce!.toFixed(),
        };
    }
}

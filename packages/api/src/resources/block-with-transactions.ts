import { Interfaces, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Resource } from "../interfaces";

@Container.injectable()
export class BlockWithTransactionsResource implements Resource {
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchainService!: Contracts.Blockchain.Blockchain;

    public raw(resource: Contracts.Shared.BlockDataWithTransactionData): object {
        return JSON.parse(JSON.stringify(resource));
    }

    public transform(resource: Contracts.Shared.BlockDataWithTransactionData): object {
        const blockData: Interfaces.IBlockData = resource.data;
        const blockTransactions: Interfaces.ITransactionData[] = resource.transactions;

        const totalTransferred: Utils.BigNumber = blockTransactions
            .filter((t) => t.type === "transfer")
            .flatMap((t) => t.asset!.recipients)
            .reduce((sum, transfer) => sum.plus(transfer!.amount), Utils.BigNumber.ZERO);

        const totalAmountTransferred: Utils.BigNumber = blockData.totalAmount.plus(totalTransferred);
        const generator: Contracts.State.Wallet = blockData.username
            ? this.walletRepository.findByUsername(blockData.username)
            : this.walletRepository.findByPublicKey(blockData.generatorPublicKey);
        const lastBlock: Interfaces.IBlock = this.blockchainService.getLastBlock();

        return {
            id: blockData.id,
            version: +blockData.version,
            height: +blockData.height,
            previous: blockData.previousBlock,
            forged: {
                reward: blockData.reward.toFixed(),
                donations: blockData.donations,
                fee: blockData.totalFee.toFixed(),
                burnedFee: blockData.totalFeeBurned!.toFixed(),
                amount: totalAmountTransferred.toFixed(),
                total: blockData.reward
                    .minus(
                        Object.values(blockData.donations!).reduce(
                            (prev, curr) => prev.plus(curr),
                            Utils.BigNumber.ZERO,
                        ),
                    )
                    .plus(blockData.totalFee)
                    .minus(blockData.totalFeeBurned!)
                    .toFixed(),
            },
            payload: {
                hash: blockData.payloadHash,
                length: blockData.payloadLength,
            },
            generator: {
                username: generator.hasAttribute("delegate.username")
                    ? generator.getAttribute("delegate.username")
                    : undefined,
                publicKey: blockData.generatorPublicKey,
            },
            signature: blockData.signature,
            confirmations: lastBlock ? lastBlock.data.height - blockData.height : 0,
            transactions: blockData.numberOfTransactions,
            timestamp: AppUtils.formatTimestamp(blockData.timestamp),
        };
    }
}

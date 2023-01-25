import { Utils } from "@solar-network/crypto";

import { Wallet, WalletRepository, WalletVoteDistribution } from "../contracts/state";

export const increaseVoteBalances = (
    wallet: Wallet,
    { updateVoters, walletRepository }: { updateVoters?: boolean; walletRepository: WalletRepository },
) => {
    increaseOrDecreaseVoteBalances(wallet, { operation: "increase", updateVoters, walletRepository });
};

export const decreaseVoteBalances = (
    wallet: Wallet,
    { updateVoters, walletRepository }: { updateVoters?: boolean; walletRepository: WalletRepository },
) => {
    increaseOrDecreaseVoteBalances(wallet, { operation: "decrease", updateVoters, walletRepository });
};

const increaseOrDecreaseVoteBalances = (
    wallet: Wallet,
    {
        operation,
        updateVoters,
        walletRepository,
    }: { operation: string; updateVoters?: boolean; walletRepository: WalletRepository },
) => {
    const blockProducers: Map<string, WalletVoteDistribution> = wallet.getVoteDistribution();
    for (const [blockProducer, { votes }] of blockProducers.entries()) {
        const blockProducerWallet = walletRepository.findByUsername(blockProducer);
        const voteBalance: Utils.BigNumber = blockProducerWallet.getAttribute(
            "blockProducer.voteBalance",
            Utils.BigNumber.ZERO,
        );

        if (operation === "increase") {
            blockProducerWallet.setAttribute("blockProducer.voteBalance", voteBalance.plus(votes));
            if (updateVoters) {
                blockProducerWallet.setAttribute(
                    "blockProducer.voters",
                    blockProducerWallet.getAttribute("blockProducer.voters") + 1,
                );
            }
        } else if (operation === "decrease") {
            blockProducerWallet.setAttribute("blockProducer.voteBalance", voteBalance.minus(votes));
            if (updateVoters) {
                blockProducerWallet.setAttribute(
                    "blockProducer.voters",
                    blockProducerWallet.getAttribute("blockProducer.voters") - 1,
                );
            }
        }
    }
};

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
    const delegates: Record<string, WalletVoteDistribution> = wallet.getVoteDistribution();
    for (const delegate of Object.keys(delegates)) {
        const delegateWallet = walletRepository.findByUsername(delegate);
        const voteBalance: Utils.BigNumber = delegateWallet.getAttribute("delegate.voteBalance", Utils.BigNumber.ZERO);

        if (operation === "increase") {
            delegateWallet.setAttribute("delegate.voteBalance", voteBalance.plus(delegates[delegate].votes));
            if (updateVoters) {
                delegateWallet.setAttribute("delegate.voters", delegateWallet.getAttribute("delegate.voters") + 1);
            }
        } else if (operation === "decrease") {
            delegateWallet.setAttribute("delegate.voteBalance", voteBalance.minus(delegates[delegate].votes));
            if (updateVoters) {
                delegateWallet.setAttribute("delegate.voters", delegateWallet.getAttribute("delegate.voters") - 1);
            }
        }
    }
};

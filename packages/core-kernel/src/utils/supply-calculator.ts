import { Utils } from "@solar-network/crypto";

import { Wallet } from "../contracts/state";

export const calculate = (wallets: readonly Wallet[]): string => {
    return wallets
        .filter((wallet) => !wallet.getBalance().isNegative())
        .reduce((partialSum, wallet) => {
            let balance = partialSum.plus(wallet.getBalance());
            if (wallet.hasAttribute("htlc.lockedBalance")) {
                balance = balance.plus(wallet.getAttribute("htlc.lockedBalance"));
            }
            return balance;
        }, Utils.BigNumber.ZERO)
        .toFixed();
};

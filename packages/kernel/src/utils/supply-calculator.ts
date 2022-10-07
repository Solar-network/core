import { Utils } from "@solar-network/crypto";

import { Wallet } from "../contracts/state";

export const calculate = (wallets: readonly Wallet[]): string => {
    return wallets
        .filter((wallet) => !wallet.getBalance().isNegative())
        .reduce((partialSum, wallet) => {
            const balance = partialSum.plus(wallet.getBalance());
            return balance;
        }, Utils.BigNumber.ZERO)
        .toFixed();
};

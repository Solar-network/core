import { Utils } from "@solar-network/crypto";

import { Wallet, WalletDelegateAttributes } from "../contracts/state";

const toDecimal = (voteBalance: Utils.BigNumber, totalSupply: Utils.BigNumber): number => {
    const decimals: number = 2;
    const exponent: number = totalSupply.toString().length - voteBalance.toString().length + 4;

    const div: number =
        +voteBalance.times(Math.pow(10, exponent)).dividedBy(totalSupply) / Math.pow(10, exponent - decimals);

    return +div.toFixed(2);
};

export const calculateVotePercent = (delegate: Wallet, supply: string): number => {
    const totalSupply: Utils.BigNumber = Utils.BigNumber.make(supply);
    const voteBalance: Utils.BigNumber = delegate.getAttribute("delegate.voteBalance");

    return toDecimal(voteBalance, totalSupply);
};

export const calculateForgedTotal = (wallet: Wallet): string => {
    const delegate: WalletDelegateAttributes = wallet.getAttribute("delegate");
    const forgedFees: Utils.BigNumber = Utils.BigNumber.make(delegate.forgedFees);
    const forgedRewards: Utils.BigNumber = Utils.BigNumber.make(delegate.forgedRewards);

    return forgedFees.plus(forgedRewards).toFixed();
};

import { Utils } from "@solar-network/crypto";

import { Wallet, WalletBlockProducerAttributes } from "../contracts/state";

const toDecimal = (voteBalance: Utils.BigNumber, totalSupply: Utils.BigNumber): number => {
    const decimals: number = 2;
    const exponent: number = totalSupply.toString().length - voteBalance.toString().length + 4;

    const div: number =
        +voteBalance.times(Math.pow(10, exponent)).dividedBy(totalSupply) / Math.pow(10, exponent - decimals);

    return +div.toFixed(2);
};

export const calculateVotePercent = (blockProducer: Wallet, supply: string): number => {
    const totalSupply: Utils.BigNumber = Utils.BigNumber.make(supply);
    const voteBalance: Utils.BigNumber = blockProducer.getAttribute("blockProducer.voteBalance");

    return toDecimal(voteBalance, totalSupply);
};

export const calculateProducedTotal = (wallet: Wallet): string => {
    const blockProducer: WalletBlockProducerAttributes = wallet.getAttribute("blockProducer");
    const fees: Utils.BigNumber = Utils.BigNumber.make(blockProducer.fees);
    const rewards: Utils.BigNumber = Utils.BigNumber.make(blockProducer.rewards);

    return fees.plus(rewards).toFixed();
};

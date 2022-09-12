import { SATOSHI } from "../constants";
import { IDonation, ITransactionData } from "../interfaces";
import { configManager } from "../managers";
import { Base58 } from "./base58";
import { BigNumber } from "./big-number";
import { calculateBlockTime, isNewBlockTime } from "./block-time-calculator";
import { ByteBuffer } from "./byte-buffer";
import { ByteBufferArray } from "./byte-buffer-array";
import { calculateReward } from "./reward-calculator";
import { sortVotes } from "./sort-votes";

let genesisTransactions: { [key: string]: boolean };
let whitelistedBlockAndTransactionIds: { [key: string]: boolean };
let currentNetwork: number;

/**
 * Get human readable string from satoshis
 */
export const formatSatoshi = (amount: BigNumber): string => {
    const localeString = (+amount / SATOSHI).toLocaleString("en", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8,
    });

    return `${localeString} ${configManager.get("network.client.symbol")}`;
};

/**
 * Check if the given block or transaction id is an exception.
 */
export const isIdException = (id: number | string | undefined): boolean => {
    if (!id) {
        return false;
    }

    const network: number = configManager.get("network.pubKeyHash");

    if (!whitelistedBlockAndTransactionIds || currentNetwork !== network) {
        currentNetwork = network;

        whitelistedBlockAndTransactionIds = [
            ...(configManager.get("exceptions.blocks") || []),
            ...(configManager.get("exceptions.transactions") || []),
        ].reduce((acc, curr) => Object.assign(acc, { [curr]: true }), {});
    }

    return !!whitelistedBlockAndTransactionIds[id];
};

export const isException = (blockOrTransaction: { id?: string; transactions?: ITransactionData[] }): boolean => {
    if (typeof blockOrTransaction.id !== "string") {
        return false;
    }

    if (blockOrTransaction.id.length < 64) {
        // old block ids, we check that the transactions inside the block are correct
        const blockExceptionTxIds: string[] = (configManager.get("exceptions.blocksTransactions") || {})[
            blockOrTransaction.id
        ];
        const blockTransactions = blockOrTransaction.transactions || [];
        if (!blockExceptionTxIds || blockExceptionTxIds.length !== blockTransactions.length) {
            return false;
        }

        blockExceptionTxIds.sort();
        const blockToCheckTxIds = blockTransactions.map((tx) => tx.id).sort();
        for (let i = 0; i < blockExceptionTxIds.length; i++) {
            if (blockToCheckTxIds[i] !== blockExceptionTxIds[i]) {
                return false;
            }
        }
    }

    return isIdException(blockOrTransaction.id);
};

export const isGenesisTransaction = (id: string): boolean => {
    const network: number = configManager.get("network.pubKeyHash");

    if (!genesisTransactions || currentNetwork !== network) {
        currentNetwork = network;

        genesisTransactions = configManager
            .get("genesisBlock.transactions")
            .reduce((acc, curr) => Object.assign(acc, { [curr.id]: true }), {});
    }

    return genesisTransactions[id];
};

export const isSupportedTransactionVersion = (version: number): boolean => {
    const { acceptLegacySchnorrTransactions, bip340 } = configManager.getMilestone();

    return version === 3 || (version === 2 && (acceptLegacySchnorrTransactions || !bip340));
};

export const calculateDonations = (height: number, reward: BigNumber): Record<string, BigNumber> => {
    const constants = configManager.getMilestone(height);
    const donations = {};

    if (!constants.donations) {
        return {};
    }

    for (const [wallet, { percent }] of Object.entries(constants.donations as Record<string, IDonation>)) {
        donations[wallet] = reward.times(Math.round(percent * 100)).dividedBy(10000);
    }

    return donations;
};

export {
    Base58,
    BigNumber,
    ByteBuffer,
    ByteBufferArray,
    calculateBlockTime,
    isNewBlockTime,
    calculateReward,
    sortVotes,
};

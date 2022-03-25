import { calculateForgingInfo } from "./calculate-forging-info";
import { calculateApproval, calculateForgedTotal } from "./delegate-calculator";
import { calculateLockExpirationStatus, calculateTransactionExpiration } from "./expiration-calculator";
import { formatSeconds } from "./format-seconds";
import { formatTimestamp } from "./format-timestamp";
import { getBlockTimeLookup } from "./get-blocktime-lookup";
import { getForgerDelegates, sendForgerSignal } from "./get-forger-delegates";
import { isBlacklisted } from "./is-blacklisted";
import { getBlockNotChainedErrorMessage, isBlockChained } from "./is-block-chained";
import { isWhitelisted } from "./is-whitelisted";
import { calculateRound, isNewRound } from "./round-calculator";
export * as IpAddress from "./ip-address";
export * as Search from "./search";
import { stringify } from "./stringify";
import { calculate } from "./supply-calculator";

export * from "@solar-network/utils";
export * from "./expiration-calculator";
export * from "./assert";
export * from "./ipc-handler";
export * from "./ipc-subprocess";
export * from "./lock";

export const delegateCalculator = { calculateApproval, calculateForgedTotal };
export const expirationCalculator = { calculateTransactionExpiration, calculateLockExpirationStatus };
export const roundCalculator = { calculateRound, isNewRound };
export const supplyCalculator = { calculate };
export const forgingInfoCalculator = { calculateForgingInfo, getBlockTimeLookup };

export {
    formatSeconds,
    formatTimestamp,
    isBlockChained,
    getBlockNotChainedErrorMessage,
    getForgerDelegates,
    isBlacklisted,
    isWhitelisted,
    sendForgerSignal,
    stringify,
};

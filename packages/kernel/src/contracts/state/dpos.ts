import { Interfaces } from "@solar-network/crypto";

import { RoundInfo } from "../shared/rounds";
import { Wallet } from "./wallets";

export interface DposState {
    getRoundInfo(): RoundInfo;
    getAllBlockProducers(): readonly Wallet[];
    getActiveBlockProducers(): readonly Wallet[];
    getRoundBlockProducers(): readonly Wallet[];
    buildVoteBalances(): void;
    buildWalletRanking(): void;
    buildBlockProducerRanking(roundInfo?: RoundInfo): void;
    setBlockProducersRound(roundInfo: RoundInfo): void;
}

export interface DposPreviousRoundState {
    getAllBlockProducers(): readonly Wallet[];
    getActiveBlockProducers(): readonly Wallet[];
    getRoundBlockProducers(): readonly Wallet[];
}

export type DposPreviousRoundStateProvider = (
    revertBlocks: Interfaces.IBlock[],
    roundInfo: RoundInfo,
) => Promise<DposPreviousRoundState>;

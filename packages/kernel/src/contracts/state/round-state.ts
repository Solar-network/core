import { Interfaces, Utils } from "@solar-network/crypto";

import { Wallet } from "./wallets";

export interface RoundState {
    applyBlock(block: Interfaces.IBlock): Promise<void>;

    revertBlock(block: Interfaces.IBlock): Promise<void>;

    detectBlockProductionFailures(block: Interfaces.IBlock): Promise<void>;

    getRewardForBlockInRound(
        height: number,
        wallet: Wallet,
    ): Promise<{ alreadyProducedBlock: boolean; reward: Utils.BigNumber }>;

    getBlockProductionFailuresToSave(): { timestamp: number; height: number; username: string }[];
    getRoundsToSave(): Record<
        number,
        { publicKey: string; balance: Utils.BigNumber; round: number; username: string }[]
    >;

    restore(): Promise<void>;
}

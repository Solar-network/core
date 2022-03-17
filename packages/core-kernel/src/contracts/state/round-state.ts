import { Interfaces, Utils } from "@solar-network/crypto";

import { Wallet } from "./wallets";

export interface RoundState {
    applyBlock(block: Interfaces.IBlock): Promise<void>;

    revertBlock(block: Interfaces.IBlock): Promise<void>;

    detectMissedBlocks(block: Interfaces.IBlock): Promise<void>;

    getRewardForBlockInRound(
        height: number,
        wallet: Wallet,
    ): Promise<{ alreadyForged: boolean; reward: Utils.BigNumber }>;
}

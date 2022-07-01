import { Interfaces } from "@solar-network/crypto";

import { Wallet } from "./wallets";

export interface BlockState {
    applyBlock(block: Interfaces.IBlock, transactionProcessing: { index: number | undefined }): Promise<void>;

    revertBlock(block: Interfaces.IBlock): Promise<void>;

    applyTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void>;

    revertTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void>;

    updateWalletVoteBalance(wallet: Wallet): void;
}

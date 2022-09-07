import { Interfaces } from "@solar-network/crypto";

import { Wallet } from "../state";

export interface SenderState {
    apply(transaction: Interfaces.ITransaction): Promise<void>;
    getWallet(address: string): Wallet | undefined;
    revert(transaction: Interfaces.ITransaction): Promise<void>;
}

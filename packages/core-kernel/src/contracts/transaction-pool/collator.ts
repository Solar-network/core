import { Interfaces } from "@solar-network/crypto";

export interface Collator {
    getBlockCandidateTransactions(): Promise<Interfaces.ITransaction[]>;
}

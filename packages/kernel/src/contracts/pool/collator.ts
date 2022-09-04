import { Interfaces } from "@solar-network/crypto";

export interface Collator {
    getBlockCandidateTransactions(validate: boolean, exclude: string[]): Promise<Interfaces.ITransaction[]>;
}

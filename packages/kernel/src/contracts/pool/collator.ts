import { Interfaces } from "@solar-network/crypto";

export interface Collator {
    getBlockCandidateTransactions(validate: boolean): Promise<Interfaces.ITransaction[]>;
}

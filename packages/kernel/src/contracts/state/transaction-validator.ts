import { Interfaces } from "@solar-network/crypto";

export interface TransactionValidator {
    validate(transaction: Interfaces.ITransaction): Promise<Interfaces.ITransaction>;
}

export type TransactionValidatorFactory = () => TransactionValidator;

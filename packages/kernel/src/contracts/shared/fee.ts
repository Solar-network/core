import { Interfaces } from "@solar-network/crypto";

export interface FeeContext {
    transaction: Interfaces.ITransaction;
    bytes: number;
    satoshiPerByte: number;
}

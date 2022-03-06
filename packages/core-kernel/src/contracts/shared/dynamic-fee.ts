import { Interfaces } from "@solar-network/crypto";

export interface DynamicFeeContext {
    transaction: Interfaces.ITransaction;
    addonBytes: number;
    satoshiPerByte: number;
}

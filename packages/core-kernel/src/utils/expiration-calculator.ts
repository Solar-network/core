import { Enums, Interfaces } from "@solar-network/crypto";

export const calculateLockExpirationStatus = (
    lastBlock: Interfaces.IBlock,
    expiration: Interfaces.IHtlcExpiration,
): boolean =>
    (expiration.type === Enums.HtlcLockExpirationType.EpochTimestamp && expiration.value <= lastBlock.data.timestamp) ||
    (expiration.type === Enums.HtlcLockExpirationType.BlockHeight && expiration.value <= lastBlock.data.height);

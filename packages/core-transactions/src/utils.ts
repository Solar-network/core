import { Managers, Utils } from "@solar-network/crypto";

export const isRecipientOnActiveNetwork = (recipientId: string): boolean =>
    Utils.Base58.decodeCheck(recipientId).readUInt8(0) === Managers.configManager.get("network.pubKeyHash");

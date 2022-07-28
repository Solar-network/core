import { Contracts, Services } from "@solar-network/kernel";

import { Wallet } from "./wallet";

export const walletFactory = (
    attributeSet: Services.Attributes.AttributeSet,
    events?: Contracts.Kernel.EventDispatcher,
) => {
    return (address: string): Wallet => {
        return new Wallet(address, new Services.Attributes.AttributeMap(attributeSet), false, events);
    };
};

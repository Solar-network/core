import { Contracts, Services } from "@solar-network/core-kernel";

import { Wallet } from "./wallet";

export const walletFactory = (
    attributeSet: Services.Attributes.AttributeSet,
    events?: Contracts.Kernel.EventDispatcher,
) => {
    return (address: string): Wallet => {
        return new Wallet(address, new Services.Attributes.AttributeMap(attributeSet), events);
    };
};

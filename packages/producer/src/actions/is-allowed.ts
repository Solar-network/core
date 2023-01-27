import { Contracts, Services, Types } from "@solar-network/kernel";

import { BlockProducerService } from "../block-producer-service";
import { BlockProducer } from "../interfaces";

export class IsAllowedAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<boolean> {
        const blockProducerService: BlockProducerService = args.blockProducerService;
        const blockProducer: BlockProducer = args.blockProducer;
        const networkState: Contracts.P2P.NetworkState = args.networkState;

        return blockProducerService.isAllowed(networkState, blockProducer);
    }
}

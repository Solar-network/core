import { Contracts, Services, Types } from "@solar-network/kernel";

import { BlockProducerService } from "../block-producer-service";
import { BlockProducer } from "../interfaces";

export class ProduceNewBlockAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<void> {
        const blockProducerService: BlockProducerService = args.blockProducerService;
        const blockProducer: BlockProducer = args.blockProducer;
        const firstAttempt: boolean = args.firstAttempt;
        const round: Contracts.P2P.CurrentRound = args.round;

        return blockProducerService.produceNewBlock(blockProducer, firstAttempt, round);
    }
}

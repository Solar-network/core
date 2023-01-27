import { Container, Contracts, Utils } from "@solar-network/kernel";

import { BlockProducerService } from "../block-producer-service";

@Container.injectable()
export class CurrentBlockProducerProcessAction implements Contracts.Kernel.ProcessAction {
    @Container.inject(Container.Identifiers.BlockProducerService)
    private readonly producer!: BlockProducerService;

    public name = "producer.currentBlockProducer";

    public async handler(): Promise<object> {
        const round = this.producer.getRound();

        Utils.assert.defined(round);

        return {
            username: round!.currentBlockProducer.username,
            rank: round!.currentBlockProducer.blockProducer.rank,
        };
    }
}

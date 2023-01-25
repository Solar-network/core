import { Container, Contracts, Utils } from "@solar-network/kernel";

import { BlockProducerService } from "../block-producer-service";

@Container.injectable()
export class LastProducedBlockRemoteAction implements Contracts.Kernel.ProcessAction {
    @Container.inject(Container.Identifiers.BlockProducerService)
    private readonly producer!: BlockProducerService;

    public name = "producer.lastProducedBlock";

    public async handler(): Promise<object> {
        const lastProducedBlock = this.producer.getLastProducedBlock();

        Utils.assert.defined(lastProducedBlock);

        return lastProducedBlock!.data;
    }
}

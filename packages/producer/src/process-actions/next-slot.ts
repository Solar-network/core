import { Container, Contracts } from "@solar-network/kernel";

import { BlockProducerService } from "../block-producer-service";

@Container.injectable()
export class NextSlotProcessAction implements Contracts.Kernel.ProcessAction {
    @Container.inject(Container.Identifiers.BlockProducerService)
    private readonly producer!: BlockProducerService;

    public name = "producer.nextSlot";

    public async handler(): Promise<object> {
        return {
            remainingTime: this.producer.getRemainingSlotTime(),
        };
    }
}

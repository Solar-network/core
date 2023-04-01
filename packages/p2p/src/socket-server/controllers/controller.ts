import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class Controller {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "p2p")
    protected readonly logger!: Contracts.Kernel.Logger;
}

import { Container, Contracts, Enums } from "@solar-network/core-kernel";

import { Action } from "../contracts";

@Container.injectable()
export class SyncingComplete implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    public async handle(): Promise<void> {
        this.logger.info("Blockchain 100% in sync :100:");

        this.events.dispatch(Enums.BlockchainEvent.Synced);
        this.blockchain.dispatch("SYNCFINISHED");
    }
}

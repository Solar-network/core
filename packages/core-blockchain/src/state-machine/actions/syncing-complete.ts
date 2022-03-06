import { Container, Contracts } from "@solar-network/core-kernel";

import { Action } from "../contracts";

@Container.injectable()
export class SyncingComplete implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    public async handle(): Promise<void> {
        this.logger.info("Blockchain 100% in sync :100:");

        this.blockchain.dispatch("SYNCFINISHED");
    }
}

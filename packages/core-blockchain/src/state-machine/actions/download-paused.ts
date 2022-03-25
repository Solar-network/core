import { Container, Contracts } from "@solar-network/core-kernel";

import { Action } from "../contracts";

@Container.injectable()
export class DownloadPaused implements Action {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public async handle(): Promise<void> {
        this.logger.info("Blockchain download paused :clock1030:");
    }
}

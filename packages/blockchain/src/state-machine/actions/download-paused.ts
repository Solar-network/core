import { Container, Contracts } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class DownloadPaused implements Action {
    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "blockchain")
    private readonly logger!: Contracts.Kernel.Logger;

    public async handle(): Promise<void> {
        this.logger.info("Blockchain download paused", "🕥");
    }
}

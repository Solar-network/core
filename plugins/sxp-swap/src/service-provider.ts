import { Container, Contracts, Providers } from "@solar-network/core-kernel";

import { SXPSwap } from "./sxp-swap";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        if (this.config().get("enabled")) {
            const logger = this.app.get<Contracts.Kernel.Logger>(Container.Identifiers.LogService);
            const sxpSwap = Symbol.for("SXPSwap");

            this.app.bind<SXPSwap>(sxpSwap).to(SXPSwap).inSingletonScope();
            this.app.get<SXPSwap>(sxpSwap).register();
            logger.info("Loaded SXP Swap Plugin");
        }
    }
}

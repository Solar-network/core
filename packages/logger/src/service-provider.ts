import { Container, Contracts, Providers, Services } from "@solar-network/kernel";

import { PinoLogger } from "./driver";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        const logManager: Services.Log.LogManager = this.app.get<Services.Log.LogManager>(
            Container.Identifiers.LogManager,
        );

        await logManager.extend("pino", async () => this.app.resolve<Contracts.Kernel.Logger>(PinoLogger).make());

        logManager.setDefaultDriver("pino");
    }
}

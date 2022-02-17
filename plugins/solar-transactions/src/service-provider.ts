import { Container, Providers } from "@arkecosystem/core-kernel";

import { BurnTransactionHandler } from "./handlers";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        this.app.bind(Container.Identifiers.TransactionHandler).to(BurnTransactionHandler);
    }
}

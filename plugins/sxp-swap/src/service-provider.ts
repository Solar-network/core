import { Providers } from "@solar-network/kernel";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        // no-op; plugin will be removed entirely in 5.0.
    }
}

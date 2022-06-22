import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class ProcessorDynamicFeeExtension extends Contracts.Pool.ProcessorExtension {
    @Container.inject(Container.Identifiers.PoolDynamicFeeMatcher)
    private readonly dynamicFeeMatcher!: Contracts.Pool.DynamicFeeMatcher;

    public async throwIfCannotBroadcast(transaction: Interfaces.ITransaction): Promise<void> {
        await this.dynamicFeeMatcher.throwIfCannotBroadcast(transaction);
    }
}

import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

@Container.injectable()
export class ProcessorFeeExtension extends Contracts.Pool.ProcessorExtension {
    @Container.inject(Container.Identifiers.PoolFeeMatcher)
    private readonly feeMatcher!: Contracts.Pool.FeeMatcher;

    public async throwIfCannotBroadcast(transaction: Interfaces.ITransaction): Promise<void> {
        await this.feeMatcher.throwIfCannotBroadcast(transaction);
    }
}

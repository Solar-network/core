import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

@Container.injectable()
export class ExpirationService implements Contracts.Pool.ExpirationService {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    public canExpire(transaction: Interfaces.ITransaction): boolean {
        return !!transaction.data.expiration;
    }

    public isExpired(transaction: Interfaces.ITransaction): boolean {
        if (this.canExpire(transaction)) {
            return this.getExpirationHeight(transaction) <= this.stateStore.getLastHeight() + 1;
        } else {
            return false;
        }
    }

    public getExpirationHeight(transaction: Interfaces.ITransaction): number {
        AppUtils.assert.defined<number>(transaction.data.expiration);
        return transaction.data.expiration;
    }
}

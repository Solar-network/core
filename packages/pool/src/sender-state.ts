import { Interfaces, Managers } from "@solar-network/crypto";
import { Container, Contracts, Providers, Services } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import {
    RetryTransactionError,
    TransactionExceedsMaximumByteSizeError,
    TransactionFailedToApplyError,
    TransactionFailedToVerifyError,
    TransactionFromWrongNetworkError,
} from "./errors";

@Container.injectable()
export class SenderState implements Contracts.Pool.SenderState {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "copy-on-write")
    private readonly handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    private corrupt = false;

    public async apply(transaction: Interfaces.ITransaction): Promise<void> {
        const maxTransactionBytes: number = this.configuration.getRequired<number>("maxTransactionBytes");
        if (transaction.serialised.length > maxTransactionBytes) {
            throw new TransactionExceedsMaximumByteSizeError(transaction, maxTransactionBytes);
        }

        const currentNetwork: number = Managers.configManager.get<number>("network.pubKeyHash");
        if (transaction.data.network && transaction.data.network !== currentNetwork) {
            throw new TransactionFromWrongNetworkError(transaction, currentNetwork);
        }

        const handler: Handlers.TransactionHandler = await this.handlerRegistry.getActivatedHandlerForTransaction(
            transaction,
        );

        if (await this.triggers.call("verifyTransaction", { handler, transaction })) {
            if (this.corrupt) {
                throw new RetryTransactionError(transaction);
            }

            try {
                await this.triggers.call("throwIfCannotEnterPool", { handler, transaction });
                await this.triggers.call("applyTransaction", { handler, transaction });
            } catch (error) {
                throw new TransactionFailedToApplyError(transaction, error);
            }
        } else {
            throw new TransactionFailedToVerifyError(transaction);
        }
    }

    public async revert(transaction: Interfaces.ITransaction): Promise<void> {
        try {
            const handler: Handlers.TransactionHandler = await this.handlerRegistry.getActivatedHandlerForTransaction(
                transaction,
            );

            await this.triggers.call("revertTransaction", { handler, transaction });
        } catch (error) {
            this.corrupt = true;
            throw error;
        }
    }

    public getWallet(address: string): Contracts.State.Wallet | undefined {
        return this.handlerRegistry.getRegisteredHandlers()[0].getWallet(address);
    }
}

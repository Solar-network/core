import { Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

@Container.injectable()
export class TransactionValidator implements Contracts.State.TransactionValidator {
    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "clone")
    private readonly handlerRegistry!: Handlers.Registry;

    public async validate(transaction: Interfaces.ITransaction): Promise<Interfaces.ITransaction> {
        const deserialised: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytesUnsafe(
            transaction.serialised,
            transaction.data.id,
        );
        const handler = await this.handlerRegistry.getActivatedHandlerForTransaction(deserialised);
        await handler.apply(deserialised);
        return deserialised;
    }
}

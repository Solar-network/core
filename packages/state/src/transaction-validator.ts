import { Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";
import { strictEqual } from "assert";

@Container.injectable()
export class TransactionValidator implements Contracts.State.TransactionValidator {
    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "clone")
    private readonly handlerRegistry!: Handlers.Registry;

    public async validate(transaction: Interfaces.ITransaction): Promise<Interfaces.ITransaction> {
        const deserialised: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytes(transaction.serialised);
        strictEqual(transaction.id, deserialised.id);
        const handler = await this.handlerRegistry.getActivatedHandlerForTransaction(deserialised);
        await handler.apply(deserialised);
        return deserialised;
    }
}

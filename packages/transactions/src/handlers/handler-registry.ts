import { Interfaces, Transactions } from "@solar-network/crypto";
import { Container, Utils } from "@solar-network/kernel";

import { DeactivatedTransactionHandlerError, InvalidTransactionTypeError } from "../errors";
import { TransactionHandlerProvider } from "./handler-provider";
import { TransactionHandler } from "./transaction";

@Container.injectable()
export class TransactionHandlerRegistry {
    @Container.inject(Container.Identifiers.TransactionHandlerProvider)
    private readonly provider!: TransactionHandlerProvider;

    @Container.multiInject(Container.Identifiers.TransactionHandler)
    private readonly handlers!: TransactionHandler[];

    @Container.postConstruct()
    public initialise(): void {
        if (this.provider.isRegistrationRequired()) {
            this.provider.registerHandlers();
        }
    }

    public getRegisteredHandlers(): TransactionHandler[] {
        return this.handlers;
    }

    public getRegisteredHandlerByType(internalType: Transactions.InternalTransactionType): TransactionHandler {
        for (const handler of this.handlers) {
            const transactionConstructor = handler.getConstructor();
            Utils.assert.defined<number>(transactionConstructor.key);
            const handlerInternalType = Transactions.InternalTransactionType.fromKey(transactionConstructor.key);
            if (handlerInternalType === internalType) {
                return handler;
            }
        }

        throw new InvalidTransactionTypeError(internalType);
    }

    public async getActivatedHandlers(): Promise<TransactionHandler[]> {
        const promises = this.handlers.map(async (handler): Promise<[TransactionHandler, boolean]> => {
            return [handler, await handler.isActivated()];
        });
        const results = await Promise.all(promises);
        const activated = results.filter(([_, activated]) => activated);
        return activated.map(([handler, _]) => handler);
    }

    public async getActivatedHandlerByType(
        internalType: Transactions.InternalTransactionType,
        transaction: Interfaces.ITransaction,
    ): Promise<TransactionHandler> {
        const handler = this.getRegisteredHandlerByType(internalType);
        if (await handler.isActivated(transaction)) {
            return handler;
        }
        throw new DeactivatedTransactionHandlerError(transaction.data.type);
    }

    public async getActivatedHandlerForTransaction(transaction: Interfaces.ITransaction): Promise<TransactionHandler> {
        const internalType = Transactions.InternalTransactionType.fromKey(transaction.data.type);
        return this.getActivatedHandlerByType(internalType, transaction);
    }
}

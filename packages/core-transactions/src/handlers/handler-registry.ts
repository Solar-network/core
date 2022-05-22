import { Container, Utils } from "@solar-network/core-kernel";
import { Interfaces, Transactions } from "@solar-network/crypto";

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
    public initialize(): void {
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
            Utils.assert.defined<number>(transactionConstructor.type);
            Utils.assert.defined<number>(transactionConstructor.typeGroup);
            const handlerInternalType = Transactions.InternalTransactionType.from(
                transactionConstructor.type,
                transactionConstructor.typeGroup,
            );
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
    ): Promise<TransactionHandler> {
        const handler = this.getRegisteredHandlerByType(internalType);
        if (await handler.isActivated()) {
            return handler;
        }
        throw new DeactivatedTransactionHandlerError(internalType);
    }

    public async getActivatedHandlerForData(transactionData: Interfaces.ITransactionData): Promise<TransactionHandler> {
        const internalType = Transactions.InternalTransactionType.from(transactionData.type, transactionData.typeGroup);
        return this.getActivatedHandlerByType(internalType);
    }
}

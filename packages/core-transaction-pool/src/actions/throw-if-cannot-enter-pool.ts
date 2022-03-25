import { Services, Types } from "@solar-network/core-kernel";
import { Handlers } from "@solar-network/core-transactions";
import { Interfaces } from "@solar-network/crypto";

export class ThrowIfCannotEnterPoolAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<void> {
        const handler: Handlers.TransactionHandler = args.handler;
        const transaction: Interfaces.ITransaction = args.transaction;

        return handler.throwIfCannotEnterPool(transaction);
    }
}

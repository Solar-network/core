import { Services, Types } from "@solar-network/core-kernel";
import { Handlers } from "@solar-network/core-transactions";
import { Interfaces } from "@solar-network/crypto";

export class VerifyTransactionAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<boolean> {
        const handler: Handlers.TransactionHandler = args.handler;
        const transaction: Interfaces.ITransaction = args.transaction;

        return handler.verify(transaction);
    }
}

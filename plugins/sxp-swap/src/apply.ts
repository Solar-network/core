import { Interfaces } from "@solar-network/crypto";
import { Services, Types } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

export class ApplyTransactionAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<void> {
        const handler: Handlers.TransactionHandler = args.handler;
        const transaction: Interfaces.ITransaction = args.transaction;

        return (handler as any).apply(transaction, "pool");
    }
}

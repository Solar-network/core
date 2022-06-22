import { Interfaces } from "@solar-network/crypto";
import { Services, Types } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

export class VerifyTransactionAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<boolean> {
        const handler: Handlers.TransactionHandler = args.handler;
        const transaction: Interfaces.ITransaction = args.transaction;

        return handler.verify(transaction);
    }
}

import { Contracts } from "@arkecosystem/core-kernel";
import { Handlers } from "@arkecosystem/core-transactions";
import { Interfaces as CryptoInterfaces, Utils } from "@arkecosystem/crypto";

export abstract class SolarTransactionHandler extends Handlers.TransactionHandler {
    public async throwIfCannotBeApplied(transaction: CryptoInterfaces.ITransaction, wallet: Contracts.State.Wallet): Promise<void> {
        if (Utils.isException(transaction.data)) {
            return;
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }
}

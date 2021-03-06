import { Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

export class WorkerScriptHandler implements Contracts.Pool.WorkerScriptHandler {
    public loadCryptoPackage(packageName: string): void {
        const pkgTransactions = require(packageName).Transactions;
        for (const txConstructor of Object.values(pkgTransactions)) {
            Transactions.TransactionRegistry.registerTransactionType(txConstructor as any);
        }
    }

    public setConfig(networkConfig: Interfaces.NetworkConfig): void {
        Managers.configManager.setConfig(networkConfig);
    }

    public setHeight(height: number): void {
        Managers.configManager.setHeight(height);
    }

    public async getTransactionFromData(
        transactionData: Interfaces.ITransactionData | string,
    ): Promise<Contracts.Pool.SerialisedTransaction> {
        const tx =
            typeof transactionData === "string"
                ? Transactions.TransactionFactory.fromBytes(Buffer.from(transactionData, "hex"))
                : Transactions.TransactionFactory.fromData(transactionData);
        return { id: tx.id!, serialised: tx.serialised.toString("hex"), isVerified: tx.isVerified };
    }
}

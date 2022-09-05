import { Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

export class WorkerScriptHandler implements Contracts.Pool.WorkerScriptHandler {
    public setConfig(networkConfig: Interfaces.NetworkConfig): void {
        Managers.configManager.setConfig(networkConfig);
    }

    public setHeight(height: number): void {
        Managers.configManager.setHeight(height);
    }

    public async getTransaction(
        transactionData: Interfaces.ITransactionData | string,
    ): Promise<Contracts.Pool.SerialisedTransaction> {
        const tx =
            typeof transactionData === "string"
                ? Transactions.TransactionFactory.fromBytes(Buffer.from(transactionData, "hex"))
                : Transactions.TransactionFactory.fromData(transactionData);

        return {
            addresses: tx.addresses,
            id: tx.id!,
            serialised: tx.serialised.toString("hex"),
            isVerified: tx.isVerified,
        };
    }
}

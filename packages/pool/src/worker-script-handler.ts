import { Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";
import { parentPort } from "worker_threads";

export class WorkerScriptHandler implements Contracts.Pool.WorkerScriptHandler {
    public setConfig(networkConfig: Interfaces.NetworkConfig): void {
        Managers.configManager.setConfig(networkConfig);
    }

    public setHeight(height: number): void {
        Managers.configManager.setHeight(height);
    }

    public async getTransaction(transactionData: Interfaces.ITransactionData | string, id?: string): Promise<void> {
        try {
            const tx =
                typeof transactionData === "string"
                    ? Transactions.TransactionFactory.fromBytes(Buffer.from(transactionData, "hex"))
                    : Transactions.TransactionFactory.fromData(transactionData);

            const result: Contracts.Pool.SerialisedTransaction = {
                addresses: tx.addresses,
                id: tx.id!,
                serialised: tx.serialised.toString("hex"),
                isVerified: tx.isVerified,
            };

            parentPort!.postMessage({ id, result });
        } catch (error) {
            parentPort!.postMessage({ id, error: error.message });
        }
    }
}

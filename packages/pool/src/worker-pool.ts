import { Enums, Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Providers } from "@solar-network/kernel";

import { defaults } from "./defaults";

type CryptoPackagesConfig = typeof defaults.workerPool.cryptoPackages;

@Container.injectable()
export class WorkerPool implements Contracts.Pool.WorkerPool {
    @Container.inject(Container.Identifiers.PoolWorkerFactory)
    private readonly createWorker!: Contracts.Pool.WorkerFactory;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly pluginConfiguration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PluginDiscoverer)
    private readonly pluginDiscoverer!: Providers.PluginDiscoverer;

    private workers: Contracts.Pool.Worker[] = [];

    @Container.postConstruct()
    public initialise(): void {
        const workerCount: number = this.pluginConfiguration.getRequired("workerPool.workerCount");
        const cryptoPackages: CryptoPackagesConfig = this.pluginConfiguration.getOptional(
            "workerPool.cryptoPackages",
            [],
        );

        for (let i = 0; i < workerCount; i++) {
            const worker = this.createWorker();
            for (const { packageName } of cryptoPackages) {
                const packageId = this.pluginDiscoverer.get(packageName).packageId;
                worker.loadCryptoPackage(packageId);
            }
            this.workers.push(worker);
        }
    }

    public isTypeGroupSupported(typeGroup: Enums.TransactionTypeGroup): boolean {
        if (typeGroup === Enums.TransactionTypeGroup.Core || typeGroup === Enums.TransactionTypeGroup.Solar) {
            return true;
        }

        const cryptoPackages: CryptoPackagesConfig = this.pluginConfiguration.getOptional(
            "workerPool.cryptoPackages",
            [],
        );
        return cryptoPackages.some((p: any) => p.typeGroup === typeGroup);
    }

    public async getTransactionFromData(
        transactionData: Interfaces.ITransactionData | Buffer,
    ): Promise<Interfaces.ITransaction> {
        const worker: Contracts.Pool.Worker = this.workers.reduce((prev, next) => {
            if (prev.getQueueSize() < next.getQueueSize()) {
                return prev;
            } else {
                return next;
            }
        });

        return worker.getTransactionFromData(transactionData);
    }
}

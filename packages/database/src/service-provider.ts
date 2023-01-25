import { Container, Contracts, Providers, Utils as AppUtils } from "@solar-network/kernel";
import { Worker as NodeWorker } from "worker_threads";

import { BlockFilter } from "./block-filter";
import { BlockHistoryService } from "./block-history-service";
import { BlockProductionFailureFilter } from "./block-production-failure-filter";
import { BlockProductionFailureHistoryService } from "./block-production-failure-history-service";
import { DatabaseService } from "./database-service";
import { ModelConverter } from "./model-converter";
import { QueryRunner } from "./query-runner";
import {
    BlockProductionFailureRepository,
    BlockRepository,
    MigrationRepository,
    RoundRepository,
    TransactionRepository,
} from "./repositories";
import { TransactionFilter } from "./transaction-filter";
import { TransactionHistoryService } from "./transaction-history-service";
import { Worker } from "./worker";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        this.app.bind(Container.Identifiers.DatabaseBlockRepository).to(BlockRepository).inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseMigrationRepository).to(MigrationRepository).inSingletonScope();
        this.app
            .bind(Container.Identifiers.DatabaseBlockProductionFailureRepository)
            .to(BlockProductionFailureRepository)
            .inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseRoundRepository).to(RoundRepository).inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseTransactionRepository).to(TransactionRepository).inSingletonScope();

        this.app.bind(Container.Identifiers.DatabaseQueryRunner).to(QueryRunner).inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseWorker).to(Worker);
        this.app.bind(Container.Identifiers.DatabaseWorkerFactory).toAutoFactory(Container.Identifiers.DatabaseWorker);
        this.app.bind(Container.Identifiers.DatabaseWorkerThreadFactory).toFactory(() => {
            return () => {
                const worker = new NodeWorker(`${__dirname}/worker-script.js`);
                return new AppUtils.WorkerThread<Contracts.Database.WorkerScriptHandler>(worker);
            };
        });

        this.app.bind(Container.Identifiers.DatabaseBlockFilter).to(BlockFilter);
        this.app.bind(Container.Identifiers.BlockHistoryService).to(BlockHistoryService);

        this.app.bind(Container.Identifiers.DatabaseBlockProductionFailureFilter).to(BlockProductionFailureFilter);
        this.app
            .bind(Container.Identifiers.BlockProductionFailureHistoryService)
            .to(BlockProductionFailureHistoryService);

        this.app.bind(Container.Identifiers.DatabaseTransactionFilter).to(TransactionFilter);
        this.app.bind(Container.Identifiers.TransactionHistoryService).to(TransactionHistoryService);

        this.app.bind(Container.Identifiers.DatabaseModelConverter).to(ModelConverter);
        this.app.bind(Container.Identifiers.DatabaseService).to(DatabaseService).inSingletonScope();

        await this.app
            .get<Contracts.Database.MigrationRepository>(Container.Identifiers.DatabaseMigrationRepository)
            .performMigrations();
    }

    public async dispose(): Promise<void> {
        await this.app.get<Contracts.Database.QueryRunner>(Container.Identifiers.DatabaseQueryRunner).maintenance();
    }

    public async required(): Promise<boolean> {
        return true;
    }
}

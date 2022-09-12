import { Container, Contracts, Providers, Services, Utils as AppUtils } from "@solar-network/kernel";
import { fork } from "child_process";
import Joi from "joi";

import {
    ApplyTransactionAction,
    RevertTransactionAction,
    ThrowIfCannotEnterPoolAction,
    VerifyTransactionAction,
} from "./actions";
import { Collator } from "./collator";
import { DynamicFeeMatcher } from "./dynamic-fee-matcher";
import { ExpirationService } from "./expiration-service";
import { Mempool } from "./mempool";
import { Processor } from "./processor";
import { ProcessorDynamicFeeExtension } from "./processor-dynamic-fee-extension";
import { Query } from "./query";
import { SenderMempool } from "./sender-mempool";
import { SenderState } from "./sender-state";
import { Service } from "./service";
import { Storage } from "./storage";
import { Worker } from "./worker";
import { WorkerPool } from "./worker-pool";

/**
 * @export
 * @class ServiceProvider
 * @extends {Providers.ServiceProvider}
 */
export class ServiceProvider extends Providers.ServiceProvider {
    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async register(): Promise<void> {
        this.registerServices();
        this.registerActions();
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async boot(): Promise<void> {
        this.app.get<Storage>(Container.Identifiers.PoolStorage).boot();
        await this.app.get<Service>(Container.Identifiers.PoolService).boot();
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async dispose(): Promise<void> {
        this.app.get<Service>(Container.Identifiers.PoolService).dispose();
        this.app.get<Storage>(Container.Identifiers.PoolStorage).dispose();
    }

    /**
     * @returns {Promise<boolean>}
     * @memberof ServiceProvider
     */
    public async required(): Promise<boolean> {
        return true;
    }

    public configSchema(): object {
        return Joi.object({
            enabled: Joi.bool().required(),
            storage: Joi.string().required(),
            maxTransactionsInPool: Joi.number().integer().min(1).required(),
            maxTransactionsPerSender: Joi.number().integer().min(1).required(),
            allowedSenders: Joi.array().items(Joi.string()).required(),
            maxTransactionsPerRequest: Joi.number().integer().min(1).required(),
            maxTransactionAge: Joi.number().integer().min(1).required(),
            maxTransactionBytes: Joi.number().integer().min(1).required(),
            dynamicFees: Joi.object({
                enabled: Joi.bool().required(),
                minFeePool: Joi.number().integer().min(0).when("enabled", { is: true, then: Joi.required() }),
                minFeeBroadcast: Joi.number().integer().min(0).when("enabled", { is: true, then: Joi.required() }),
                addonBytes: Joi.object()
                    .when("enabled", { is: true, then: Joi.required() })
                    .pattern(Joi.string(), Joi.number().integer().min(0).required()),
            }).required(),
            workerPool: Joi.object({
                workerCount: Joi.number().integer().min(1).required(),
            }).required(),
        }).unknown(true);
    }

    private registerServices(): void {
        this.app.bind(Container.Identifiers.PoolCollator).to(Collator);
        this.app.bind(Container.Identifiers.PoolDynamicFeeMatcher).to(DynamicFeeMatcher);
        this.app.bind(Container.Identifiers.PoolExpirationService).to(ExpirationService);
        this.app.bind(Container.Identifiers.PoolMempool).to(Mempool).inSingletonScope();
        this.app.bind(Container.Identifiers.PoolProcessor).to(Processor);
        this.app.bind(Container.Identifiers.PoolProcessorFactory).toAutoFactory(Container.Identifiers.PoolProcessor);
        this.app.bind(Container.Identifiers.PoolQuery).to(Query);
        this.app.bind(Container.Identifiers.PoolSenderMempool).to(SenderMempool);
        this.app
            .bind(Container.Identifiers.PoolSenderMempoolFactory)
            .toAutoFactory(Container.Identifiers.PoolSenderMempool);
        this.app.bind(Container.Identifiers.PoolSenderState).to(SenderState);
        this.app.bind(Container.Identifiers.PoolService).to(Service).inSingletonScope();
        this.app.bind(Container.Identifiers.PoolStorage).to(Storage).inSingletonScope();

        this.app.bind(Container.Identifiers.PoolWorkerPool).to(WorkerPool).inSingletonScope();
        this.app.bind(Container.Identifiers.PoolWorker).to(Worker);
        this.app.bind(Container.Identifiers.PoolWorkerFactory).toAutoFactory(Container.Identifiers.PoolWorker);
        this.app.bind(Container.Identifiers.PoolWorkerIpcSubprocessFactory).toFactory(() => {
            return () => {
                const subprocess = fork(`${__dirname}/worker-script.js`);
                return new AppUtils.IpcSubprocess<Contracts.Pool.WorkerScriptHandler>(subprocess);
            };
        });

        this.app.bind(Container.Identifiers.PoolProcessorExtension).to(ProcessorDynamicFeeExtension);
    }

    private registerActions(): void {
        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("applyTransaction", new ApplyTransactionAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("revertTransaction", new RevertTransactionAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("throwIfCannotEnterPool", new ThrowIfCannotEnterPoolAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("verifyTransaction", new VerifyTransactionAction());
    }
}

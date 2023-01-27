import { Container, Contracts, Providers, Services } from "@solar-network/kernel";
import Joi from "joi";

import { IsAllowedAction, ProduceNewBlockAction } from "./actions";
import { BlockProducer } from "./block-producer";
import { BlockProducerService } from "./block-producer-service";
import { RelayHost } from "./interfaces";
import {
    CurrentBlockProducerProcessAction,
    LastProducedBlockRemoteAction,
    NextSlotProcessAction,
} from "./process-actions";

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
        this.app
            .bind<BlockProducerService>(Container.Identifiers.BlockProducerService)
            .to(BlockProducerService)
            .inSingletonScope();

        this.registerActions();

        this.registerProcessActions();
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async boot(): Promise<void> {
        const aux: string | undefined = this.config().get("aux");
        const delay: number = this.config().get("delay") || 0;

        const blockProducers: BlockProducer[] = this.makeBlockProducers();

        const blockProducerService = this.app.get<BlockProducerService>(Container.Identifiers.BlockProducerService);

        blockProducerService.register(this.config().get("hosts") as RelayHost[]);

        if (aux) {
            await blockProducerService.boot(blockProducers, delay, Buffer.from(aux, "hex"));
        } else {
            await blockProducerService.boot(blockProducers, delay);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async dispose(): Promise<void> {
        await this.app.get<BlockProducerService>(Container.Identifiers.BlockProducerService).dispose();
    }

    /**
     * @returns {Promise<boolean>}
     * @memberof ServiceProvider
     */
    public async bootWhen(): Promise<boolean> {
        const { keys, secrets }: Record<string, string> = this.app.config("blockProducers")!;

        if (
            (!keys || !keys.length || !Array.isArray(keys)) &&
            (!secrets || !secrets.length || !Array.isArray(secrets))
        ) {
            return false;
        }

        return true;
    }

    public configSchema(): object {
        return Joi.object({
            aux: Joi.string().hex().length(64),
            hosts: Joi.array()
                .items(
                    Joi.object({
                        hostname: Joi.string()
                            .ip({
                                version: ["ipv4", "ipv6"],
                            })
                            .required(),
                        port: Joi.number().integer().min(1).max(65535).required(),
                    }),
                )
                .required(),
        }).unknown(true);
    }

    private registerActions(): void {
        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("produceNewBlock", new ProduceNewBlockAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("isAllowed", new IsAllowedAction());
    }

    private registerProcessActions(): void {
        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(CurrentBlockProducerProcessAction));

        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(NextSlotProcessAction));

        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(LastProducedBlockRemoteAction));
    }

    /**
     * @private
     * @returns {BlockProducer[]}
     * @memberof ServiceProvider
     */
    private makeBlockProducers(): BlockProducer[] {
        const blockProducers: Set<BlockProducer> = new Set<BlockProducer>();

        for (const key of this.app.config("blockProducers.keys")) {
            blockProducers.add(new BlockProducer(key));
        }

        return [...blockProducers];
    }
}

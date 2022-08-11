import { Container, Contracts, Providers, Services } from "@solar-network/kernel";
import Joi from "joi";

import { ForgeNewBlockAction, IsForgingAllowedAction } from "./actions";
import { Delegate } from "./delegate";
import { ForgerService } from "./forger-service";
import { RelayHost } from "./interfaces";
import { CurrentDelegateProcessAction, LastForgedBlockRemoteAction, NextSlotProcessAction } from "./process-actions";

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
        this.app.bind<ForgerService>(Container.Identifiers.ForgerService).to(ForgerService).inSingletonScope();

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

        const delegates: Delegate[] = this.makeDelegates();

        const forgerService = this.app.get<ForgerService>(Container.Identifiers.ForgerService);

        forgerService.register(this.config().get("hosts") as RelayHost[]);

        if (aux) {
            await forgerService.boot(delegates, delay, Buffer.from(aux, "hex"));
        } else {
            await forgerService.boot(delegates, delay);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async dispose(): Promise<void> {
        await this.app.get<ForgerService>(Container.Identifiers.ForgerService).dispose();
    }

    /**
     * @returns {Promise<boolean>}
     * @memberof ServiceProvider
     */
    public async bootWhen(): Promise<boolean> {
        const { keys, secrets }: Record<string, string> = this.app.config("delegates")!;

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
            .bind("forgeNewBlock", new ForgeNewBlockAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("isForgingAllowed", new IsForgingAllowedAction());
    }

    private registerProcessActions(): void {
        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(CurrentDelegateProcessAction));

        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(NextSlotProcessAction));

        this.app
            .get<Contracts.Kernel.ProcessActionsService>(Container.Identifiers.ProcessActionsService)
            .register(this.app.resolve(LastForgedBlockRemoteAction));
    }

    /**
     * @private
     * @returns {Delegate[]}
     * @memberof ServiceProvider
     */
    private makeDelegates(): Delegate[] {
        const delegates: Set<Delegate> = new Set<Delegate>();

        for (const key of this.app.config("delegates.keys")) {
            delegates.add(new Delegate(key));
        }

        return [...delegates];
    }
}

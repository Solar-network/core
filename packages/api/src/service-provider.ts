import { Providers } from "@solar-network/kernel";
import Joi from "joi";

import { EventListener } from "./event-listener";
import Handlers from "./handlers";
import { Identifiers } from "./identifiers";
import { preparePlugins } from "./plugins";
import { Server } from "./server";
import { DelegateSearchService, LockSearchService, WalletSearchService } from "./services";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        this.app.bind(Identifiers.WalletSearchService).to(WalletSearchService);
        this.app.bind(Identifiers.DelegateSearchService).to(DelegateSearchService);
        this.app.bind(Identifiers.LockSearchService).to(LockSearchService);
        this.app.bind(Identifiers.EventListener).to(EventListener).inSingletonScope();

        if (this.config().get("server.http.enabled")) {
            await this.buildServer("http", Identifiers.HTTP);
        }

        if (this.config().get("server.https.enabled")) {
            await this.buildServer("https", Identifiers.HTTPS);
        }
    }

    public async boot(): Promise<void> {
        const http = this.config().get("server.http.enabled");
        const https = this.config().get("server.https.enabled");

        if (http || https) {
            this.app.get<EventListener>(Identifiers.EventListener).initialise();
        }

        if (http) {
            await this.app.get<Server>(Identifiers.HTTP).boot();
        }

        if (https) {
            await this.app.get<Server>(Identifiers.HTTPS).boot();
        }
    }

    public async dispose(): Promise<void> {
        if (this.config().get("server.http.enabled")) {
            await this.app.get<Server>(Identifiers.HTTP).dispose();
        }

        if (this.config().get("server.https.enabled")) {
            await this.app.get<Server>(Identifiers.HTTPS).dispose();
        }
    }

    public configSchema(): object {
        return Joi.object({
            server: Joi.object({
                http: Joi.object({
                    enabled: Joi.bool().required(),
                    host: Joi.string().required(),
                    port: Joi.number().integer().min(1).max(65535).required(),
                }).required(),
                https: Joi.object({
                    enabled: Joi.bool().required(),
                    host: Joi.string().required(),
                    port: Joi.number().integer().min(1).max(65535).required(),
                    tls: Joi.object({
                        key: Joi.string().when("...enabled", { is: true, then: Joi.required() }),
                        cert: Joi.string().when("...enabled", { is: true, then: Joi.required() }),
                    }).required(),
                }).required(),
            }).required(),
            plugins: Joi.object({
                log: Joi.object({
                    enabled: Joi.bool().required(),
                }).required(),
                cache: Joi.object({
                    enabled: Joi.bool().required(),
                    stdTTL: Joi.number().integer().min(0).required(),
                    checkperiod: Joi.number().integer().min(0).required(),
                }).required(),
                semaphore: Joi.object({
                    enabled: Joi.bool().required(),
                    database: Joi.object({
                        levelOne: Joi.object({
                            concurrency: Joi.number().integer().min(0).required(),
                            queueLimit: Joi.number().integer().min(0).required(),
                            maxOffset: Joi.number().integer().min(0).required(),
                        }).required(),
                        levelTwo: Joi.object({
                            concurrency: Joi.number().integer().min(0).required(),
                            queueLimit: Joi.number().integer().min(0).required(),
                        }).required(),
                    }).required(),
                    memory: Joi.object({
                        levelOne: Joi.object({
                            concurrency: Joi.number().integer().min(0).required(),
                            queueLimit: Joi.number().integer().min(0).required(),
                            maxOffset: Joi.number().integer().min(0).required(),
                        }).required(),
                        levelTwo: Joi.object({
                            concurrency: Joi.number().integer().min(0).required(),
                            queueLimit: Joi.number().integer().min(0).required(),
                        }).required(),
                    }).required(),
                }).required(),
                rateLimit: Joi.object({
                    enabled: Joi.bool().required(),
                    points: Joi.number().integer().min(0).required(),
                    duration: Joi.number().integer().min(0).required(),
                    whitelist: Joi.array().items(Joi.string()).required(),
                    blacklist: Joi.array().items(Joi.string()).required(),
                }).required(),
                socketTimeout: Joi.number().integer().min(0).required(),
                whitelist: Joi.array().items(Joi.string()).required(),
                trustProxy: Joi.bool().required(),
            }).required(),
            options: Joi.object({
                basePath: Joi.string().required(),
                estimateTotalCount: Joi.bool().required(),
            }).required(),
        }).unknown(true);
    }

    private async buildServer(type: string, id: symbol): Promise<void> {
        this.app.bind<Server>(id).to(Server).inSingletonScope();

        const server: Server = this.app.get<Server>(id);

        await server.initialise(`Public API (${type.toUpperCase()})`, {
            ...this.config().get(`server.${type}`),
            ...{
                routes: {
                    cors: true,
                },
            },
        });
        await server.register(preparePlugins(this.config().all()));

        await server.register({
            plugin: Handlers,
            routes: { prefix: this.config().get("options.basePath") },
        });
    }
}

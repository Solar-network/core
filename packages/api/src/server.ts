import { badData, isBoom, notFound } from "@hapi/boom";
import { RequestRoute, Server as HapiServer, ServerInjectOptions, ServerInjectResponse, ServerRoute } from "@hapi/hapi";
import { Identities, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Providers, Types, Utils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";
import { readFileSync } from "fs";
import { readJsonSync } from "fs-extra";

import * as Schemas from "./schemas";

declare module "@hapi/hapi" {
    interface ServerApplicationState {
        app: Contracts.Kernel.Application;
        schemas: typeof Schemas;
    }
}

// todo: review the implementation
@Container.injectable()
export class Server {
    /**
     * @private
     * @type {Contracts.Kernel.Application}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    /**
     * @private
     * @type {Providers.PluginConfiguration}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/blockchain")
    private readonly blockchainConfiguration!: Providers.PluginConfiguration;

    /**
     * @private
     * @type {Providers.PluginConfiguration}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/api")
    private readonly configuration!: Providers.PluginConfiguration;

    /**
     * @private
     * @type {Contracts.Kernel.Logger}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    /**
     * @private
     * @type {Container.Identifiers.TransactionHandlerRegistry}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "null")
    private readonly nullHandlerRegistry!: Handlers.Registry;

    /**
     * @private
     * @type {Providers.PluginConfiguration}
     * @memberof Server
     */
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly poolConfiguration!: Providers.PluginConfiguration;

    /**
     * @private
     * @type {HapiServer}
     * @memberof Server
     */
    private server!: HapiServer;

    /**
     * @private
     * @type {string}
     * @memberof Server
     */
    private name!: string;

    /**
     * @type {string}
     * @memberof Server
     */
    public get uri(): string {
        return this.server.info.uri;
    }

    /**
     * @param {string} name
     * @param {Types.JsonObject} optionsServer
     * @returns {Promise<void>}
     * @memberof Server
     */
    public async initialise(name: string, optionsServer: Types.JsonObject): Promise<void> {
        this.name = name;
        this.server = new HapiServer(this.getServerOptions(optionsServer));
        const timeout: number = this.configuration.getRequired<number>("plugins.socketTimeout");
        this.server.listener.timeout = timeout;
        this.server.listener.keepAliveTimeout = timeout;
        this.server.listener.headersTimeout = timeout;

        this.server.app.app = this.app;
        this.server.app.schemas = Schemas;

        this.server.ext("onPreHandler", (request, h) => {
            request.headers["content-type"] = "application/json";
            return h.continue;
        });

        this.server.ext("onPreResponse", (request, h) => {
            if (isBoom(request.response) && request.response.isServer && request.response.name !== "QueryFailedError") {
                this.logger.error(request.response.stack);
            }
            return h.continue;
        });
    }

    /**
     * @returns {Promise<void>}
     * @memberof Server
     */
    public async boot(): Promise<void> {
        try {
            const swaggerJson = readJsonSync(`${__dirname}/www/api.json`);
            const dummyAddress = Identities.Address.fromPassphrase("");
            const networkCharacter = dummyAddress.slice(0, 1);
            swaggerJson.servers.push({ url: this.configuration.getRequired<string>("options.basePath") });
            swaggerJson.info.version = this.app.version();
            swaggerJson.components.schemas.address.pattern = swaggerJson.components.schemas.recipientId.pattern =
                swaggerJson.components.schemas.address.pattern.substring(0, 1) +
                networkCharacter +
                swaggerJson.components.schemas.address.pattern.substring(2);
            swaggerJson.components.schemas.recipientId.example =
                swaggerJson.components.schemas.transaction.properties.asset.example.transfers[0].recipientId =
                    dummyAddress;
            swaggerJson.components.schemas.walletIdentifier.pattern =
                swaggerJson.components.schemas.walletIdentifier.pattern.substring(0, 1) +
                networkCharacter +
                swaggerJson.components.schemas.walletIdentifier.pattern.substring(2);
            swaggerJson.components.schemas.transactions.properties.transactions.maxItems =
                this.poolConfiguration.getRequired<number>("maxTransactionsPerRequest");

            const registeredTransactionHandlers = await this.nullHandlerRegistry.getRegisteredHandlers();
            const typeGroups: Set<number> = new Set();
            const types: Set<number> = new Set();

            for (const handler of registeredTransactionHandlers) {
                const constructor = handler.getConstructor();
                const type: number = constructor.type!;
                const typeGroup: number = constructor.typeGroup!;
                typeGroups.add(typeGroup);
                types.add(type);
            }

            swaggerJson.components.schemas.transactionTypes.enum = [...types];
            swaggerJson.components.schemas.transactionTypeGroups.enum = [...typeGroups];
            swaggerJson.components.schemas.transactionVersions.enum =
                Transactions.schemas.transactionBaseSchema.properties.version.enum;

            const seconds: number = this.blockchainConfiguration.get("missedBlocksLookback") as number;
            const days: number = +(seconds / 86400).toFixed(2);

            swaggerJson.paths["/blocks/missed"].get.summary = swaggerJson.paths["/blocks/missed"].get.summary.replace(
                "X",
                days,
            );
            swaggerJson.paths["/delegates/{identifier}/blocks/missed"].get.summary = swaggerJson.paths[
                "/delegates/{identifier}/blocks/missed"
            ].get.summary.replace("X", days);

            this.server.route({
                method: "GET",
                path: "/api.json",
                handler: () => swaggerJson,
            });

            this.server.route({
                method: "GET",
                path: "/{param*}",
                handler: {
                    directory: {
                        path: (request) => {
                            if (request.path.length < 20) {
                                return `${__dirname}/www`;
                            } else {
                                return notFound();
                            }
                        },
                    },
                },
            });

            await this.server.start();

            this.logger.info(`${this.name} Server started at ${this.server.info.uri}`);
        } catch {
            await this.app.terminate(`Failed to start ${this.name} Server!`);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof Server
     */
    public async dispose(): Promise<void> {
        try {
            await this.server.stop();

            this.logger.info(`${this.name} Server stopped at ${this.server.info.uri}`);
        } catch {
            await this.app.terminate(`Failed to stop ${this.name} Server!`);
        }
    }

    /**
     * @param {(any|any[])} plugins
     * @returns {Promise<void>}
     * @memberof Server
     */
    // @todo: add proper types
    public async register(plugins: any | any[]): Promise<void> {
        return this.server.register(plugins);
    }

    /**
     * @param {(ServerRoute | ServerRoute[])} routes
     * @returns {Promise<void>}
     * @memberof Server
     */
    public async route(routes: ServerRoute | ServerRoute[]): Promise<void> {
        return this.server.route(routes);
    }

    public getRoute(method: string, path: string): RequestRoute | undefined {
        return this.server.table().find((route) => route.method === method.toLowerCase() && route.path === path);
    }

    public subscription(path: string): void {
        return this.server.subscription(path);
    }

    public publish(path: string, payload) {
        return this.server.publish(path, payload);
    }

    /**
     * @param {(string | ServerInjectOptions)} options
     * @returns {Promise<void>}
     * @memberof Server
     */
    public async inject(options: string | ServerInjectOptions): Promise<ServerInjectResponse> {
        return this.server.inject(options);
    }

    /**
     * @private
     * @param {Record<string, any>} options
     * @returns {object}
     * @memberof Server
     */
    private getServerOptions(options: Record<string, any>): object {
        options = { ...options };

        delete options.enabled;

        if (options.tls) {
            options.tls.key = readFileSync(options.tls.key).toString();
            options.tls.cert = readFileSync(options.tls.cert).toString();
        }

        const defaultOptions = {
            router: {
                stripTrailingSlash: true,
            },
            routes: {
                payload: {
                    async failAction(request, h, err) {
                        return badData(err.message);
                    },
                },
                validate: {
                    async failAction(request, h, err) {
                        return badData(err.message);
                    },
                },
            },
        };

        return Utils.merge(defaultOptions, options);
    }
}

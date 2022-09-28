import Hapi from "@hapi/hapi";
import { Crypto, Managers } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Providers, Services, Utils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import { PortsResource } from "../resources";
import { Controller } from "./controller";

@Container.injectable()
export class NodeController extends Controller {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly poolConfiguration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "null")
    private readonly nullHandlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.ConfigRepository)
    private readonly configRepository!: Services.Config.ConfigRepository;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly networkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    public async status(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<{ data: { synced: boolean; now: number; blocksCount: number; timestamp: number } }> {
        const lastBlock = this.blockchain.getLastBlock();
        const networkHeight = this.networkMonitor.getNetworkHeight();

        return {
            data: {
                synced: this.blockchain.isSynced(),
                now: lastBlock ? lastBlock.data.height : 0,
                blocksCount: networkHeight && lastBlock ? networkHeight - lastBlock.data.height : 0,
                timestamp: Crypto.Slots.getTime(),
            },
        };
    }

    public async syncing(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<{ data: { syncing: boolean; blocks: number; height: number; id: string | undefined } }> {
        const lastBlock = this.blockchain.getLastBlock();
        const networkHeight = this.networkMonitor.getNetworkHeight();

        return {
            data: {
                syncing: !this.blockchain.isSynced(),
                blocks: networkHeight && lastBlock ? networkHeight - lastBlock.data.height : 0,
                height: lastBlock ? lastBlock.data.height : 0,
                id: lastBlock?.data?.id,
            },
        };
    }

    public async configuration(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<unknown> {
        const constants = { ...Managers.configManager.getMilestone(this.blockchain.getLastHeight()) };

        const network = Managers.configManager.get("network");

        const removeFalsy = (obj: object) => {
            Object.keys(obj).forEach(
                (key) =>
                    (obj[key] === false && delete obj[key]) ||
                    (obj[key] && typeof obj[key] === "object" && removeFalsy(obj[key])),
            );
            return obj;
        };

        return removeFalsy(
            Utils.cloneDeep({
                data: {
                    core: {
                        version: this.app.version(),
                    },
                    nethash: network.nethash,
                    slip44: network.slip44,
                    wif: network.wif,
                    token: network.client.token,
                    symbol: network.client.symbol,
                    explorer: network.client.explorer,
                    version: network.pubKeyHash,
                    ports: super.toResource(this.configRepository, PortsResource),
                    constants,
                    pool: {
                        maxTransactionsInPool: this.poolConfiguration.getRequired<number>("maxTransactionsInPool"),
                        maxTransactionsPerSender:
                            this.poolConfiguration.getRequired<number>("maxTransactionsPerSender"),
                        maxTransactionsPerRequest:
                            this.poolConfiguration.getRequired<number>("maxTransactionsPerRequest"),
                        maxTransactionAge: this.poolConfiguration.getRequired<number>("maxTransactionAge"),
                        maxTransactionBytes: this.poolConfiguration.getRequired<number>("maxTransactionBytes"),
                    },
                },
            }),
        );
    }

    public async configurationCrypto(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        return {
            data: Managers.configManager.all(),
        };
    }

    public async fees(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        const handlers = this.nullHandlerRegistry.getRegisteredHandlers();
        const handlersKey = {};
        const txsTypes: Array<{ type: number; typeGroup: number }> = [];
        for (const handler of handlers) {
            handlersKey[`${handler.getConstructor().type}-${handler.getConstructor().typeGroup}`] =
                handler.getConstructor().key;
            txsTypes.push({ type: handler.getConstructor().type!, typeGroup: handler.getConstructor().typeGroup! });
        }

        const results = await this.transactionRepository.getFeeStatistics(txsTypes, request.query.days);

        const groupedByTypeGroup = {};
        for (const result of results) {
            if (!groupedByTypeGroup[result.typeGroup]) {
                groupedByTypeGroup[result.typeGroup] = {};
            }

            const handlerKey = handlersKey[`${result.type}-${result.typeGroup}`];

            groupedByTypeGroup[result.typeGroup][handlerKey] = {
                avg: result.avg,
                burned: result.burned,
                max: result.max,
                min: result.min,
                sum: result.sum,
            };
        }

        return { meta: { days: request.query.days }, data: groupedByTypeGroup };
    }
}

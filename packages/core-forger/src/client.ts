import { Container, Contracts, Utils } from "@solar-network/core-kernel";
import { Codecs, Nes, NetworkState } from "@solar-network/core-p2p";
import { Blocks, Interfaces } from "@solar-network/crypto";

import { HostNoResponseError, RelayCommunicationError } from "./errors";
import { RelayHost } from "./interfaces";

const MAX_PAYLOAD_CLIENT = 20 * 1024 * 1024; // allow large value of max payload communicating with relay

/**
 * @export
 * @class Client
 */
@Container.injectable()
export class Client {
    /**
     * @private
     * @type {Contracts.Kernel.Application}
     * @memberof ForgerService
     */

    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    /**
     * @private
     * @type {Contracts.Kernel.Logger}
     * @memberof Client
     */
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    /**
     * @type {RelayHost[]}
     * @memberof Client
     */
    public hosts: RelayHost[] = [];

    /**
     * @private
     * @type {RelayHost}
     * @memberof Client
     */
    // @ts-ignore
    private host: RelayHost;

    /**
     * @param {RelayHost[]} hosts
     * @memberof Client
     */
    public register(hosts: RelayHost[]): void {
        this.hosts = hosts.map((host: RelayHost) => {
            const url = `ws://${Utils.IpAddress.normalizeAddress(host.hostname)}:${host.port}`;
            const options = { ws: { maxPayload: MAX_PAYLOAD_CLIENT } };
            const connection = new Nes.Client(url, options);
            connection.connect().catch((e) => {}); // connect promise can fail when p2p is not ready, it's fine it will retry

            connection.onError = (e) => {
                this.logger.error(`${e.message} :bangbang:`);
            };

            host.socket = connection;

            return host;
        });

        this.host = this.hosts[0];
    }

    /**
     * @memberof Client
     */
    public dispose(): void {
        for (const host of this.hosts) {
            const socket: Nes.Client | undefined = host.socket;

            if (socket) {
                socket.disconnect();
            }
        }
    }

    /**
     * @param {Interfaces.IBlock} block
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async broadcastBlock(block: Interfaces.IBlock): Promise<void> {
        try {
            await this.emit("p2p.blocks.postBlock", {
                block: Blocks.Serializer.serializeWithTransactions({
                    ...block.data,
                    transactions: block.transactions.map((tx) => tx.data),
                }),
            });
        } catch (error) {
            this.logger.error(`Broadcast block failed: ${error.message} :bangbang:`);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async syncWithNetwork(): Promise<void> {
        await this.selectHost();

        this.logger.debug(`Sending wake-up check to relay node ${this.host.hostname}`);

        try {
            await this.emit("p2p.internal.syncBlockchain");
        } catch (error) {
            this.logger.error(`Could not sync check: ${error.message} :bangbang:`);
        }
    }

    /**
     * @returns {Promise<Contracts.P2P.CurrentRound>}
     * @memberof Client
     */
    public async getRound(): Promise<Contracts.P2P.CurrentRound> {
        await this.selectHost();

        return this.emit<Contracts.P2P.CurrentRound>("p2p.internal.getCurrentRound");
    }

    public async getSlotNumber(timestamp?: number): Promise<number> {
        await this.selectHost();

        return this.emit<number>("p2p.internal.getSlotNumber", { timestamp });
    }

    public async getNetworkState(log: boolean): Promise<Contracts.P2P.NetworkState> {
        return await NetworkState.parse(
            await this.emit<Contracts.P2P.NetworkState>("p2p.internal.getNetworkState", { log }, 4000),
        );
    }

    /**
     * @returns {Promise<Contracts.P2P.Status>}
     * @memberof Client
     */
    public async getStatus(): Promise<Contracts.P2P.Status> {
        return await this.emit<Contracts.P2P.Status>(
            "p2p.peer.getStatus",
            { headers: { version: this.app.version() } },
            2000,
        );
    }

    /**
     * @returns {Promise<Contracts.P2P.ForgingTransactions>}
     * @memberof Client
     */
    public async getTransactions(): Promise<Contracts.P2P.ForgingTransactions> {
        return this.emit<Contracts.P2P.ForgingTransactions>("p2p.internal.getUnconfirmedTransactions");
    }

    /**
     * @param {string} event
     * @param {({ error: string } | { activeDelegates: string[] } | Interfaces.IBlockData | Interfaces.ITransactionData)} body
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async emitEvent(
        event: string,
        body: { error: string } | { activeDelegates: string[] } | Interfaces.IBlockData | Interfaces.ITransactionData,
    ): Promise<void> {
        // NOTE: Events need to be emitted to the localhost. If you need to trigger
        // actions on a remote host based on events you should be using webhooks
        // that get triggered by the events you wish to react to.

        const allowedHosts: string[] = ["127.0.0.1", "::1"];

        const host: RelayHost | undefined = this.hosts.find((item) =>
            allowedHosts.some((allowedHost) => item.hostname.includes(allowedHost)),
        );

        if (!host) {
            this.logger.error("emitEvent: unable to find any local hosts :bangbang:");
            return;
        }

        try {
            await this.emit("p2p.internal.emitEvent", { event, body });
        } catch (error) {
            this.logger.error(`Failed to emit "${event}" to "${host.hostname}:${host.port}" :bangbang:`);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async selectHost(): Promise<void> {
        for (let i = 0; i < 10; i++) {
            for (const host of this.hosts) {
                if (host.socket && host.socket._isReady()) {
                    this.host = host;
                    return;
                }
            }

            await Utils.sleep(100);
        }

        this.logger.debug(
            `No open socket connection to any host: ${JSON.stringify(
                this.hosts.map((host) => `${host.hostname}:${host.port}`),
            )} :bangbang:`,
        );

        throw new HostNoResponseError(this.hosts.map((host) => host.hostname).join());
    }

    /**
     * @private
     * @template T
     * @param {string} event
     * @param {Record<string, any>} [payload={}]
     * @param {number} [timeout=4000]
     * @returns {Promise<T>}
     * @memberof Client
     */
    private async emit<T = object>(event: string, payload: Record<string, any> = {}, timeout = 4000): Promise<T> {
        try {
            Utils.assert.defined<Nes.Client>(this.host.socket);

            const codec = this.getCodec(event);

            const options = {
                path: event,
                payload: codec.request.serialize(payload),
            };

            const response: any = await this.host.socket.request(options);

            return codec.response.deserialize(response.payload);
        } catch (error) {
            throw new RelayCommunicationError(`${this.host.hostname}:${this.host.port}<${event}>`, error.message);
        }
    }

    private getCodec(event: string) {
        const codecs = {
            "p2p.internal.emitEvent": Codecs.emitEvent,
            "p2p.internal.getUnconfirmedTransactions": Codecs.getUnconfirmedTransactions,
            "p2p.internal.getCurrentRound": Codecs.getCurrentRound,
            "p2p.internal.getNetworkState": Codecs.getNetworkState,
            "p2p.internal.getSlotNumber": Codecs.getSlotNumber,
            "p2p.internal.syncBlockchain": Codecs.syncBlockchain,
            "p2p.blocks.postBlock": Codecs.postBlock,
            "p2p.peer.getStatus": Codecs.getStatus,
        };

        return codecs[event];
    }
}

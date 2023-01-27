import { Blocks, Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils } from "@solar-network/kernel";
import { Client as NesClient } from "@solar-network/nes";
import { Codecs, NetworkState } from "@solar-network/p2p";

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
     * @memberof BlockProducerService
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
    private host!: RelayHost;

    /**
     * @param {RelayHost[]} hosts
     * @memberof Client
     */
    public register(hosts: RelayHost[]): void {
        this.hosts = hosts.map((host: RelayHost) => {
            return host;
        });

        this.host = this.hosts[0];
    }

    /**
     * @memberof Client
     */
    public dispose(): void {
        for (const host of this.hosts) {
            const socket: NesClient | undefined = host.socket;

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
                block: Blocks.Serialiser.serialiseWithTransactions({
                    ...block.data,
                    transactions: block.transactions.map((tx) => tx.data),
                }),
                headers: { port: 0, version: this.app.version() },
            });
        } catch (error) {
            this.logger.error(`Broadcast block failed: ${error.message}`);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async syncWithNetwork(): Promise<void> {
        await this.selectHost();

        this.logger.debug(`Sending wake-up check to relay node ${this.host.hostname}`, "🛌");

        try {
            await this.emit("p2p.internal.syncBlockchain");
        } catch (error) {
            this.logger.error(`Could not sync check: ${error.message}`);
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
            { headers: { port: 0, version: this.app.version() } },
            2000,
        );
    }

    /**
     * @returns {Promise<Contracts.P2P.PoolData>}
     * @memberof Client
     */
    public async getTransactions(): Promise<Contracts.P2P.PoolData> {
        return this.emit<Contracts.P2P.PoolData>("p2p.transactions.getUnconfirmedTransactions", {
            headers: { port: 0, version: this.app.version() },
        });
    }

    /**
     * @param {string} event
     * @param {({ error: string } | { activeBlockProducers: string[] } | Interfaces.IBlockData | Interfaces.ITransactionData)} body
     * @returns {Promise<void>}
     * @memberof Client
     */
    public async emitEvent(
        event: string,
        body:
            | { error: string }
            | { activeBlockProducers: string[] }
            | Interfaces.IBlockData
            | Interfaces.ITransactionData,
    ): Promise<void> {
        // NOTE: Events need to be emitted to the localhost. If you need to trigger
        // actions on a remote host based on events you should be using webhooks
        // that get triggered by the events you wish to react to.

        const allowedHosts: string[] = ["127.0.0.1", "::1"];

        const host: RelayHost | undefined = this.hosts.find((item) =>
            allowedHosts.some((allowedHost) => item.hostname.includes(allowedHost)),
        );

        if (!host) {
            this.logger.error("Unable to find any local hosts");
            return;
        }

        try {
            await this.emit("p2p.internal.emitEvent", { event, body });
        } catch (error) {
            this.logger.error(`Failed to emit "${event}" to "${host.hostname}:${host.port}"`);
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
                } else {
                    if (host.socket) {
                        host.socket.onError = (e) => {};
                        host.socket.disconnect();
                        host.socket = undefined;
                    }

                    const url = `ws://${Utils.IpAddress.normaliseAddress(host.hostname)}:${host.port}`;
                    const options = { ws: { maxPayload: MAX_PAYLOAD_CLIENT } };
                    const connection = new NesClient(url, options);
                    connection.connect().catch((e) => {});

                    connection.onError = (e) => {
                        if (e.message !== "Connection terminated while waiting to connect") {
                            this.logger.error(`${e.message}`);
                        }
                    };

                    host.socket = connection;
                }
            }

            await Utils.sleep(250);
        }

        this.logger.debug(
            `No open socket connection to any host: ${JSON.stringify(
                this.hosts.map((host) => `${host.hostname}:${host.port}`),
            )}`,
            "❗",
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
    private async emit<T = object>(
        event: string,
        payload: Record<string, any> = {},
        timeout: number = 4000,
    ): Promise<T> {
        try {
            Utils.assert.defined<NesClient>(this.host.socket);

            const codec = this.getCodec(event);

            const options = {
                path: event,
                payload: codec.request.serialise(payload),
            };

            const response: any = await this.host.socket.request(options);

            return codec.response.deserialise(response.payload);
        } catch (error) {
            throw new RelayCommunicationError(`${this.host.hostname}:${this.host.port}<${event}>`, error.message);
        }
    }

    private getCodec(event: string) {
        const codecs = {
            "p2p.internal.emitEvent": Codecs.emitEvent,
            "p2p.internal.getCurrentRound": Codecs.getCurrentRound,
            "p2p.internal.getNetworkState": Codecs.getNetworkState,
            "p2p.internal.getSlotNumber": Codecs.getSlotNumber,
            "p2p.internal.syncBlockchain": Codecs.syncBlockchain,
            "p2p.blocks.postBlock": Codecs.postBlock,
            "p2p.peer.getStatus": Codecs.getStatus,
            "p2p.transactions.getUnconfirmedTransactions": Codecs.getUnconfirmedTransactions,
        };

        return codecs[event];
    }
}

import { isBoom } from "@hapi/boom";
import { Container, Contracts, Enums, Utils } from "@solar-network/core-kernel";
import { Server } from "http";
import { createServer } from "http";
import { Socket } from "net";

import { BlocksRoute } from "../routes/blocks";
import { PeerRoute } from "../routes/peer";
import { TransactionsRoute } from "../routes/transactions";

@Container.injectable()
export class BanHammerPlugin {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PeerProcessor)
    private readonly peerProcessor!: Contracts.P2P.PeerProcessor;

    private banList: Map<string, number> = new Map();
    private sockets: Map<string, Map<Socket, boolean>> = new Map();

    private banSeconds!: number;

    private synced: boolean = false;

    public ban(ip: string, reason: string) {
        if (this.banSeconds === 0 || this.banSeconds === undefined) {
            return;
        }

        const isWhitelisted: boolean = this.peerProcessor.isWhitelisted({ ip } as Contracts.P2P.Peer);

        if (!isWhitelisted) {
            if (!this.banList.has(ip)) {
                this.logger.debug(
                    `Banning ${ip} for ${Utils.formatSeconds(
                        this.banSeconds,
                    )}. Reason: ${reason} :oncoming_police_car:`,
                );
            }
            const timeNow: number = new Date().getTime() / 1000;
            this.banList.set(ip, timeNow);
        }
    }

    public createServer(): Server {
        const listener = createServer();

        listener.on("connection", (socket: Socket) => {
            const ip = socket.remoteAddress;
            if (ip) {
                if (this.banList.has(ip)) {
                    const bannedUntil: number = this.banList.get(ip)!;
                    const timeNow: number = new Date().getTime() / 1000;
                    if (timeNow - bannedUntil >= this.banSeconds) {
                        this.banList.delete(ip);
                    } else {
                        socket.destroy();
                        return;
                    }
                }

                if (this.sockets.has(ip)) {
                    const foundSockets = this.sockets.get(ip)!;
                    for (const [foundSocket] of foundSockets) {
                        if (foundSocket !== socket) {
                            foundSocket.destroy();
                        }
                    }
                }

                let sockets = this.sockets.get(ip)!;
                if (!sockets) {
                    sockets = new Map<Socket, boolean>();
                    this.sockets.set(ip, sockets);
                }

                sockets.set(socket, false);

                socket.on("close", () => {
                    if (this.sockets.has(ip)) {
                        const foundSockets = this.sockets.get(ip);
                        if (foundSockets && foundSockets.has(socket)) {
                            const established = foundSockets.get(socket);
                            if (!this.banList.has(ip)) {
                                const nesBanReason: string = (socket as any).ban;
                                const nesOpen: boolean = (socket as any).wsOpen;
                                if (nesBanReason) {
                                    this.ban(ip, nesBanReason);
                                } else if (this.synced && nesOpen && !established) {
                                    this.ban(ip, "Did not make an endpoint request");
                                } else if (this.synced && !nesOpen) {
                                    this.ban(ip, "Failed to complete websocket handshake");
                                }
                            }
                            foundSockets.delete(socket);
                            if (foundSockets.size === 0) {
                                this.sockets.delete(ip);
                            }
                        }
                    }
                });
            }
        });

        listener.timeout = 2000;

        return listener;
    }

    public register(server, banSeconds: number): void {
        this.banSeconds = banSeconds;

        this.events.listen(Enums.BlockchainEvent.Synced, {
            handle: async () => {
                if (!this.synced) {
                    setTimeout(() => {
                        this.synced = true;
                    }, 60000);
                }
            },
        });
        const routesConfigByPath = {
            ...this.app.resolve(PeerRoute).getRoutesConfigByPath(),
            ...this.app.resolve(BlocksRoute).getRoutesConfigByPath(),
            ...this.app.resolve(TransactionsRoute).getRoutesConfigByPath(),
        };

        server.ext({
            type: "onPostAuth",
            method: async (request, h) => {
                if (routesConfigByPath[request.path]) {
                    const ip: string = request.info.remoteAddress;
                    if (request.socket) {
                        this.setEstablished(ip, request.socket.getWebSocket());
                    }
                }
                return h.continue;
            },
        });

        server.ext({
            type: "onPreResponse",
            method: async (request, h) => {
                const ip: string = request.info.remoteAddress;
                if (isBoom(request.response)) {
                    if (ip && request.response.output.statusCode < 499) {
                        this.ban(
                            ip,
                            request.response.output.statusCode == 404
                                ? "Not a websocket connection"
                                : request.response.message,
                        );
                    }
                }
                return h.continue;
            },
        });
    }

    private setEstablished(ip: string, socket: Socket): void {
        let sockets: Map<Socket, boolean>;
        if (this.sockets.has(ip)) {
            sockets = this.sockets.get(ip)!;
        } else {
            sockets = new Map<Socket, boolean>();
            this.sockets.set(ip, sockets);
        }
        sockets.set(socket, true);
    }
}

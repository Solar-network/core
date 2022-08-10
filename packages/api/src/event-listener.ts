import { Container, Contracts, Enums, Providers } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import { Identifiers } from "./identifiers";
import { Server } from "./server";

@Container.injectable()
export class EventListener {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/api")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "null")
    private readonly handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async initialise(): Promise<void> {
        if (!this.configuration.get("ws.enabled")) {
            return;
        }

        const servers: Server[] = [];
        if (this.configuration.get("server.http.enabled")) {
            servers.push(this.app.get<Server>(Identifiers.HTTP));
        }
        if (this.configuration.get("server.https.enabled")) {
            servers.push(this.app.get<Server>(Identifiers.HTTPS));
        }

        const events: string[] = this.configuration.get("ws.events")!;
        const registeredTransactionHandlers = await this.handlerRegistry.getRegisteredHandlers();

        for (const [eventGroupName, eventGroup] of Object.entries(Enums)) {
            for (const event of Object.values(eventGroup)) {
                if (events.includes("*") || events.includes(event)) {
                    const eventPath = `/events/${event}`;
                    for (const server of servers) {
                        server.subscription(eventPath);
                        if (eventGroupName === "BlockEvent" || eventGroupName === "VoteEvent") {
                            server.subscription(`${eventPath}/{id}`);
                        } else if (eventGroupName === "TransactionEvent") {
                            server.subscription(`${eventPath}/{id}`);
                            for (const handler of registeredTransactionHandlers) {
                                server.subscription(`${eventPath}/{id}/${handler.getConstructor().key}`);
                                server.subscription(`${eventPath}/${handler.getConstructor().key}`);
                            }
                        }
                    }
                    this.events.listen(event, {
                        handle: async ({ data }) => {
                            const endpoints = new Set([eventPath]);

                            if (eventGroupName === "BlockEvent") {
                                if (this.walletRepository.hasByPublicKey(data.generatorPublicKey)) {
                                    const wallet = this.walletRepository.findByPublicKey(data.generatorPublicKey);
                                    if (wallet.hasAttribute("delegate.username")) {
                                        endpoints.add(`${eventPath}/${wallet.getAttribute("delegate.username")}`);
                                    }
                                }
                            } else if (eventGroupName === "TransactionEvent") {
                                if (this.walletRepository.hasByPublicKey(data.senderPublicKey)) {
                                    const wallet = this.walletRepository.findByPublicKey(data.senderPublicKey);
                                    const handler = await this.handlerRegistry.getActivatedHandlerForData(data);
                                    const address = wallet.getAddress();
                                    const { key } = handler.getConstructor();
                                    endpoints.add(`${eventPath}/${address}`);
                                    endpoints.add(`${eventPath}/${address}/${key}`);
                                    endpoints.add(`${eventPath}/${key}`);
                                    if (data.recipientId) {
                                        endpoints.add(`${eventPath}/${data.recipientId}`);
                                        endpoints.add(`${eventPath}/${data.recipientId}/${key}`);
                                    }
                                    if (data.asset && data.asset.transfers) {
                                        if (key === "transfer") {
                                            for (const transfer of data.asset.transfers) {
                                                endpoints.add(`${eventPath}/${transfer.recipientId}`);
                                                endpoints.add(`${eventPath}/${transfer.recipientId}/${key}`);
                                            }
                                        }
                                    }
                                }
                            } else if (eventGroupName === "VoteEvent") {
                                if (data.previousVotes) {
                                    for (const previousVote of Object.keys(data.previousVotes)) {
                                        if (
                                            !data.votes ||
                                            data.votes[previousVote] !== data.previousVotes[previousVote]
                                        ) {
                                            endpoints.add(`${eventPath}/${previousVote}`);
                                        }
                                    }
                                }
                                if (data.votes) {
                                    for (const vote of Object.keys(data.votes)) {
                                        if (!data.previousVotes || data.previousVotes[vote] !== data.votes[vote]) {
                                            endpoints.add(`${eventPath}/${vote}`);
                                        }
                                    }
                                }
                            }

                            for (const server of servers) {
                                for (const endpoint of endpoints) {
                                    server.publish(endpoint, { data });
                                }
                            }
                        },
                    });
                }
            }
        }
    }
}

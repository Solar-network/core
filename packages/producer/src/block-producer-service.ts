import { Blocks, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import { Container, Contracts, Enums, Services, Utils as AppUtils } from "@solar-network/kernel";
import { NetworkStateStatus } from "@solar-network/p2p";
import { Handlers } from "@solar-network/transactions";
import delay from "delay";
import { writeJsonSync } from "fs-extra";

import { Client } from "./client";
import { HostNoResponseError, RelayCommunicationError } from "./errors";
import { BlockProducer } from "./interfaces";
import { RelayHost } from "./interfaces";

@Container.injectable()
export class BlockProducerService {
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
     * @memberof BlockProducerService
     */
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    /**
     * @private
     * @type {Handlers.TransactionHandlerProvider}
     * @memberof BlockProducerService
     */
    @Container.inject(Container.Identifiers.TransactionHandlerProvider)
    private readonly handlerProvider!: Handlers.TransactionHandlerProvider;

    /**
     * @private
     * @type {BlockProducer[]}
     * @memberof BlockProducerService
     */
    private activeBlockProducers: BlockProducer[] = [];

    /**
     * @private
     * @type {{ [key: string]: string }}
     * @memberof BlockProducerService
     */
    private allUsernames: { [key: string]: string } = {};

    /**
     * @private
     * @type {Buffer | undefined}
     * @memberof BlockProducerService
     */
    private aux: Buffer | undefined;

    /**
     * @private
     * @type {Client}
     * @memberof BlockProducerService
     */
    private client!: Client;

    /**
     * @private
     * @type {BlockProducer[]}
     * @memberof BlockProducerService
     */
    private blockProducers: BlockProducer[] = [];

    /**
     * @private
     * @type {number}
     * @memberof BlockProducerService
     */
    private delay: number = 0;

    /**
     * @private
     * @type {number}
     * @memberof BlockProducerService
     */
    private errorCount: number = 0;

    /**
     * @private
     * @type {{ [key: string]: string }}
     * @memberof BlockProducerService
     */
    private usernames: { [key: string]: string } = {};

    /**
     * @private
     * @type {BlockProducer[]}
     * @memberof BlockProducerService
     */
    private inactiveBlockProducers: BlockProducer[] = [];

    /**
     * @private
     * @type {boolean}
     * @memberof BlockProducerService
     */
    private isStopped: boolean = false;

    /**
     * @private
     * @type {(Contracts.P2P.CurrentRound | undefined)}
     * @memberof BlockProducerService
     */
    private round: Contracts.P2P.CurrentRound | undefined;

    /**
     * @private
     * @type {(Interfaces.IBlock | undefined)}
     * @memberof BlockProducerService
     */
    private lastProducedBlock: Interfaces.IBlock | undefined;

    /**
     * @private
     * @type {(Interfaces.ITransactionData[])}
     * @memberof BlockProducerService
     */
    private transactions;

    /**
     * @private
     * @type {boolean}
     * @memberof BlockProducerService
     */
    private initialised: boolean = false;

    /**
     * @private
     * @type {boolean}
     * @memberof BlockProducerService
     */
    private logAppReady: boolean = true;

    public getRound(): Contracts.P2P.CurrentRound | undefined {
        return this.round;
    }

    public getRemainingSlotTime(): number | undefined {
        return this.round ? this.getRoundRemainingSlotTime(this.round) : undefined;
    }

    public getLastProducedBlock(): Interfaces.IBlock | undefined {
        return this.lastProducedBlock;
    }

    /**
     * @param {*} options
     * @memberof BlockProducerService
     */
    public register(hosts: RelayHost[]): void {
        this.client = this.app.resolve<Client>(Client);
        this.client.register(hosts);
    }

    /**
     * @param {BlockProducer[]} blockProducers
     * @returns {Promise<void>}
     * @memberof BlockProducerService
     */
    public async boot(blockProducers: BlockProducer[], delay: number, aux?: Buffer): Promise<void> {
        if (this.handlerProvider.isRegistrationRequired()) {
            this.handlerProvider.registerHandlers();
        }

        this.aux = aux;
        this.delay = delay;

        this.blockProducers = blockProducers.filter((value, index, self) => {
            return index === self.findIndex((blockProducer) => blockProducer.publicKey === value.publicKey);
        });

        let timeout: number = 2000;
        try {
            await this.loadRound();
            AppUtils.assert.defined<Contracts.P2P.CurrentRound>(this.round);
            timeout = 0;
        } catch (error) {
            this.logger.warning("Waiting for a responsive host", "⏳");
        } finally {
            this.checkLater(timeout);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof BlockProducerService
     */
    public async dispose(): Promise<void> {
        this.isStopped = true;

        this.client.dispose();
    }

    /**
     * todo: make this private
     *
     * @returns {Promise<void>}
     * @memberof BlockProducerService
     */
    public async checkSlot(): Promise<void> {
        try {
            if (this.isStopped) {
                return;
            }

            await this.loadRound();

            AppUtils.assert.defined<Contracts.P2P.CurrentRound>(this.round);

            if (this.round.timestamp < 0) {
                return this.checkLater(this.getRemainingSlotTime()!);
            }

            AppUtils.assert.defined<string>(this.round.currentBlockProducer.publicKey);

            const blockProducer: BlockProducer | undefined = this.isActiveBlockProducer(
                this.round.currentBlockProducer.publicKey,
            );

            if (!blockProducer) {
                AppUtils.assert.defined<string>(this.round.nextBlockProducer.publicKey);

                if (this.isActiveBlockProducer(this.round.nextBlockProducer.publicKey)) {
                    const { blockTime } = Managers.configManager.getMilestone(this.round.lastBlock.height);
                    const username = this.usernames[this.round.nextBlockProducer.publicKey];

                    this.logger.info(
                        `${username} is due to produce a block in ${AppUtils.pluralise(
                            "second",
                            blockTime,
                            true,
                        )} from now`,
                        "✨",
                    );

                    await this.client.syncWithNetwork();
                }

                return this.checkLater(this.getRoundRemainingSlotTime(this.round));
            }

            this.errorCount = 0;

            await this.app
                .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
                .call("produceNewBlock", {
                    blockProducerService: this,
                    blockProducer,
                    firstAttempt: true,
                    round: this.round,
                });

            this.logAppReady = true;

            return this.checkLater(this.getRoundRemainingSlotTime(this.round));
        } catch (error) {
            if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                this.gracefulError(error);
            } else {
                //
            }

            // no idea when this will be ok, so waiting 2s before checking again
            return this.checkLater(2000);
        }
    }

    /**
     * @param {BlockProducer} blockProducer
     * @param {Contracts.P2P.CurrentRound} round
     * @param {Contracts.P2P.NetworkState} networkState
     * @returns {Promise<void>}
     * @memberof BlockProducerService
     */
    public async produceNewBlock(
        blockProducer: BlockProducer,
        firstAttempt: boolean,
        round: Contracts.P2P.CurrentRound,
    ): Promise<void> {
        if (this.delay > 0) {
            await delay(this.delay);
        }

        setImmediate(async () => {
            let errored = false;
            const minimumMs = 2000;
            try {
                const networkState: Contracts.P2P.NetworkState = await this.client.getNetworkState(firstAttempt);
                const networkStateHeight = networkState.getNodeHeight();

                AppUtils.assert.defined<number>(networkStateHeight);
                AppUtils.assert.defined<string>(blockProducer.publicKey);

                Managers.configManager.setHeight(networkStateHeight);

                const roundSlot: number = await this.client.getSlotNumber(round.timestamp);

                if (firstAttempt) {
                    this.transactions = await this.getTransactionsToIncludeInBlock();
                }

                const block: Interfaces.IBlock | undefined = blockProducer.produce(this.transactions, {
                    aux: this.aux,
                    previousBlock: {
                        id: networkState.getLastBlockId(),
                        height: networkStateHeight,
                    },
                    timestamp: round.timestamp,
                    reward: round.reward,
                });

                const timeLeftInMs: number = this.getRoundRemainingSlotTime(round);

                const prettyName = this.usernames[blockProducer.publicKey];

                const { state } = await this.client.getStatus();
                const currentSlot = await this.client.getSlotNumber();
                const lastBlockSlot = await this.client.getSlotNumber(state.header.timestamp);

                if (lastBlockSlot === currentSlot || blockProducer.publicKey !== round.currentBlockProducer.publicKey) {
                    if (
                        firstAttempt &&
                        ((networkState.getLastGenerator() === blockProducer.publicKey &&
                            networkState.getLastSlotNumber() === roundSlot) ||
                            (state.header.generatorPublicKey === blockProducer.publicKey &&
                                lastBlockSlot === roundSlot))
                    ) {
                        this.logger.warning(
                            `Not going to produce a block because ${prettyName} has already done so on another node`,
                            "✋",
                        );
                    }
                    return;
                }

                if (networkState.getNodeHeight() !== round.lastBlock.height) {
                    this.logger.warning(
                        `Network height (${networkState
                            .getNodeHeight()
                            ?.toLocaleString()}) and round height (${round.lastBlock.height.toLocaleString()}) are out of sync`,
                        "🐌",
                    );
                }

                if (this.isAllowed(networkState, blockProducer)) {
                    if (
                        timeLeftInMs >= minimumMs &&
                        currentSlot === roundSlot &&
                        blockProducer.publicKey === round.currentBlockProducer.publicKey
                    ) {
                        AppUtils.assert.defined<Interfaces.IBlock>(block);
                        if ((await this.client.getSlotNumber(block.data.timestamp)) !== lastBlockSlot) {
                            this.logger.info(
                                `${prettyName} produced a new block at height ${block.data.height.toLocaleString()} with ${AppUtils.pluralise(
                                    "transaction",
                                    block.data.numberOfTransactions,
                                    true,
                                )}`,
                                "🪄",
                            );

                            await this.client.broadcastBlock(block);

                            this.lastProducedBlock = block;
                            this.client.emitEvent(Enums.BlockEvent.Produced, block.getHeader());

                            for (const transaction of this.transactions) {
                                this.client.emitEvent(Enums.TransactionEvent.IncludedInBlock, transaction);
                            }
                        }
                    } else if (timeLeftInMs > 0) {
                        this.logger.warning(
                            `Failed to produce new block by ${prettyName}, because there were ${timeLeftInMs}ms left in the current slot (less than ${minimumMs}ms)`,
                        );
                    } else {
                        this.logger.warning(
                            `Failed to produce new block by ${prettyName}, because already in next slot`,
                        );
                    }
                }
            } catch (error) {
                if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                    this.gracefulError(error);
                }
                errored = true;
            }
            await delay(1000);

            try {
                await this.loadRound();
            } catch (error) {
                if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                    this.gracefulError(error);
                }
                errored = true;
            }
            if (errored) {
                this.errorCount++;
            } else {
                this.errorCount = 0;
            }

            const { blockTime } = Managers.configManager.getMilestone(round.lastBlock.height);
            if (this.errorCount < blockTime - 1) {
                return this.produceNewBlock(blockProducer, false, this.round!);
            }
        });
    }

    /**
     * @returns {Promise<Interfaces.ITransaction[]>}
     * @memberof BlockProducerService
     */
    public async getTransactionsToIncludeInBlock(): Promise<Interfaces.ITransaction[]> {
        const response = await this.client.getTransactions();
        if (AppUtils.isEmpty(response)) {
            this.logger.warning("Could not get unconfirmed transactions from pool");
            return [];
        }
        const transactions = response.transactions.map((hex) =>
            Transactions.TransactionFactory.fromBytesUnsafe(Buffer.from(hex, "hex")),
        );
        this.logger.debug(
            `Received ${AppUtils.pluralise("transaction", transactions.length, true)} ` +
                `from the pool containing ${AppUtils.pluralise("transaction", response.poolSize, true)}`,
            "🪣",
        );
        return transactions;
    }

    /**
     * @param {Contracts.P2P.NetworkState} networkState
     * @param {BlockProducer} blockProducer
     * @returns {boolean}
     * @memberof BlockProducerService
     */
    public isAllowed(networkState: Contracts.P2P.NetworkState, blockProducer: BlockProducer): boolean {
        if (networkState.status === NetworkStateStatus.Unknown) {
            this.logger.info("Failed to get network state from client - will not produce a block", "💣");
            return false;
        } else if (networkState.status === NetworkStateStatus.ColdStart) {
            this.logger.info("Skipping slot because of cold start - will not produce a block", "💣");
            return false;
        } else if (networkState.status === NetworkStateStatus.BelowMinimumBlockProducers) {
            this.logger.info("Not peered with enough block producers to get quorum - will not produce a block", "💣");
            return false;
        }

        const removeDuplicateBlockHeaders = (blockHeaders) => {
            let lastSeen;
            const sortedHeaders = blockHeaders.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));

            return sortedHeaders.reduce((sum, block) => {
                if (lastSeen !== block.id) {
                    sum.push(block);
                }
                lastSeen = block.id;
                return sum;
            }, []);
        };

        const overHeightBlockHeaders: Array<{ [ip: string]: any }> = networkState.getOverHeightBlockHeaders();
        const distinctOverHeightBlockHeaders: Array<{ [ip: string]: any }> =
            removeDuplicateBlockHeaders(overHeightBlockHeaders);

        if (distinctOverHeightBlockHeaders.length > 0) {
            this.logger.info(
                `Detected ${AppUtils.pluralise(
                    "distinct overheight block header",
                    distinctOverHeightBlockHeaders.length,
                    true,
                )}`,
                "😴",
            );

            for (const overHeightBlockHeader of overHeightBlockHeaders) {
                if (overHeightBlockHeader.generatorPublicKey === blockProducer.publicKey) {
                    AppUtils.assert.defined<string>(blockProducer.publicKey);

                    try {
                        const { verified } = Blocks.BlockFactory.fromData(
                            overHeightBlockHeader as Interfaces.IBlockData,
                        )!.verification;
                        if (verified) {
                            this.logger.warning(
                                `${
                                    this.usernames[blockProducer.publicKey]
                                } already produced a block - will not produce a block`,
                                "💣",
                            );
                            return false;
                        }
                    } catch {
                        //
                    }
                }
            }
        }

        if (!networkState.canProduceBlock()) {
            networkState.setOverHeightBlockHeaders(distinctOverHeightBlockHeaders);

            this.logger.info("Not enough quorum to produce next block - will not produce a block", "💣");
            this.logger.debug(`Network State: ${networkState.toJson()}`, "💣");

            return false;
        }

        return true;
    }

    /**
     * @private
     * @param {string} publicKey
     * @returns {(BlockProducer | undefined)}
     * @memberof BlockProducerService
     */
    private isActiveBlockProducer(publicKey: string): BlockProducer | undefined {
        return this.blockProducers.find((blockProducer) => blockProducer.publicKey === publicKey);
    }

    /**
     * @private
     * @returns {Promise<void>}
     * @memberof BlockProducerService
     */
    private async loadRound(): Promise<void> {
        this.round = await this.client.getRound();

        this.allUsernames = this.round.allBlockProducers.reduce((acc, wallet) => {
            AppUtils.assert.defined<string>(wallet.publicKey);

            return Object.assign(acc, {
                [wallet.publicKey]: wallet.username,
            });
        }, {});

        this.usernames = this.round.blockProducers.reduce((acc, wallet) => {
            AppUtils.assert.defined<string>(wallet.publicKey);

            return Object.assign(acc, {
                [wallet.publicKey]: wallet.username,
            });
        }, {});

        const oldActiveBlockProducers: BlockProducer[] = this.activeBlockProducers;
        const oldInactiveBlockProducers: BlockProducer[] = this.inactiveBlockProducers;

        this.activeBlockProducers = this.blockProducers.filter((blockProducer) => {
            AppUtils.assert.defined<string>(blockProducer.publicKey);

            return this.usernames.hasOwnProperty(blockProducer.publicKey);
        });

        this.inactiveBlockProducers = this.blockProducers.filter((blockProducer) => {
            AppUtils.assert.defined<string>(blockProducer.publicKey);

            return !this.activeBlockProducers.includes(blockProducer);
        });

        if (!this.initialised) {
            AppUtils.sendSignal("SIGTERM");

            const jsonFile: string = `${process.env.SOLAR_CORE_PATH_TEMP}/block-producer.json`;
            try {
                writeJsonSync(jsonFile, {
                    pid: process.pid,
                    publicKeys: this.blockProducers.map((blockProducer) => blockProducer.publicKey),
                });
            } catch {
                this.app.terminate(`Could not save block producer data to ${jsonFile}`);
            }

            this.printLoadedBlockProducers();
        } else {
            const newlyActiveBlockProducers = this.activeBlockProducers
                .map((blockProducer) => blockProducer.publicKey)
                .filter(
                    (activeBlockProducer) =>
                        !oldActiveBlockProducers
                            .map((oldBlockProducer) => oldBlockProducer.publicKey)
                            .includes(activeBlockProducer),
                )
                .map((publicKey) => this.usernames[publicKey]);
            const newlyInactiveBlockProducers = this.inactiveBlockProducers
                .map((blockProducer) => blockProducer.publicKey)
                .filter(
                    (inactiveBlockProducer) =>
                        !oldInactiveBlockProducers
                            .map((oldBlockProducer) => oldBlockProducer.publicKey)
                            .includes(inactiveBlockProducer),
                )
                .map((publicKey) => (this.allUsernames[publicKey] ? this.allUsernames[publicKey] : publicKey));

            if (newlyActiveBlockProducers.length === 1) {
                this.logger.info(`${newlyActiveBlockProducers[0]} is now an active block producer`, "🎉");
            } else if (newlyActiveBlockProducers.length > 1) {
                this.logger.info(
                    `${newlyActiveBlockProducers
                        .join(", ")
                        .replace(/,(?=[^,]*$)/, " and")} are now active block producers`,
                    "🎉",
                );
            }

            if (newlyInactiveBlockProducers.length === 1) {
                this.logger.info(`${newlyInactiveBlockProducers[0]} is no longer an active block producer`, "😢");
            } else if (newlyInactiveBlockProducers.length > 1) {
                this.logger.info(
                    `${newlyInactiveBlockProducers
                        .join(", ")
                        .replace(/,(?=[^,]*$)/, " and")} are no longer active block producers`,
                    "😢",
                );
            }
        }

        this.initialised = true;
    }

    /**
     * @private
     * @param {number} timeout
     * @memberof BlockProducerService
     */
    private checkLater(timeout: number): void {
        setTimeout(() => this.checkSlot(), timeout);
    }

    /**
     * @private
     * @memberof BlockProducerService
     */
    private printLoadedBlockProducers(): void {
        if (this.activeBlockProducers.length > 0) {
            this.logger.info(
                `Loaded ${AppUtils.pluralise(
                    "active block producer",
                    this.activeBlockProducers.length,
                    true,
                )}: ${this.activeBlockProducers
                    .map(({ publicKey }) => {
                        AppUtils.assert.defined<string>(publicKey);

                        return `${this.usernames[publicKey]}`;
                    })
                    .join(", ")}`,
                "👷",
            );
        }

        if (this.blockProducers.length > this.activeBlockProducers.length) {
            this.logger.info(
                `Loaded ${AppUtils.pluralise(
                    "inactive block producer",
                    this.inactiveBlockProducers.length,
                    true,
                )}: ${this.inactiveBlockProducers
                    .map(({ publicKey }) => {
                        AppUtils.assert.defined<string>(publicKey);

                        return `${
                            this.allUsernames[publicKey]
                                ? this.allUsernames[publicKey]
                                : `unregistered block producer (public key: ${publicKey})`
                        }`;
                    })
                    .join(", ")}`,
                "🙍",
            );
        }
    }

    private getRoundRemainingSlotTime(round: Contracts.P2P.CurrentRound): number {
        const epoch = new Date(Managers.configManager.getMilestone(1).epoch).getTime();
        const { blockTime } = Managers.configManager.getMilestone(round.lastBlock.height);

        return epoch + round.timestamp * 1000 + blockTime * 1000 - Date.now();
    }

    private gracefulError(error: Error): void {
        if (error.message.includes("blockchain isn't ready") || error.message.includes("App is not ready")) {
            if (this.logAppReady) {
                this.logger.info("Waiting for relay to become ready", "⏳");
                this.logAppReady = false;
            }
        } else {
            this.logger.warning(error.message);
        }
    }
}

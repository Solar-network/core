import { Container, Contracts, Enums, Services, Utils as AppUtils } from "@solar-network/core-kernel";
import { NetworkStateStatus } from "@solar-network/core-p2p";
import { Handlers } from "@solar-network/core-transactions";
import { Blocks, Interfaces, Managers, Transactions } from "@solar-network/crypto";
import delay from "delay";
import { writeJSONSync } from "fs-extra";

import { Client } from "./client";
import { HostNoResponseError, RelayCommunicationError } from "./errors";
import { Delegate } from "./interfaces";
import { RelayHost } from "./interfaces";

@Container.injectable()
export class ForgerService {
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
     * @memberof ForgerService
     */
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    /**
     * @private
     * @type {Handlers.TransactionHandlerProvider}
     * @memberof ForgerService
     */
    @Container.inject(Container.Identifiers.TransactionHandlerProvider)
    private readonly handlerProvider!: Handlers.TransactionHandlerProvider;

    /**
     * @private
     * @type {Delegate[]}
     * @memberof ForgerService
     */
    private activeDelegates: Delegate[] = [];

    /**
     * @private
     * @type {{ [key: string]: string }}
     * @memberof ForgerService
     */
    private allUsernames: { [key: string]: string } = {};

    /**
     * @private
     * @type {Client}
     * @memberof ForgerService
     */
    private client!: Client;

    /**
     * @private
     * @type {Delegate[]}
     * @memberof ForgerService
     */
    private delegates: Delegate[] = [];

    /**
     * @private
     * @type {number}
     * @memberof ForgerService
     */
    private errorCount: number = 0;

    /**
     * @private
     * @type {{ [key: string]: string }}
     * @memberof ForgerService
     */
    private usernames: { [key: string]: string } = {};

    /**
     * @private
     * @type {Delegate[]}
     * @memberof ForgerService
     */
    private inactiveDelegates: Delegate[] = [];

    /**
     * @private
     * @type {boolean}
     * @memberof ForgerService
     */
    private isStopped: boolean = false;

    /**
     * @private
     * @type {(Contracts.P2P.CurrentRound | undefined)}
     * @memberof ForgerService
     */
    private round: Contracts.P2P.CurrentRound | undefined;

    /**
     * @private
     * @type {(Interfaces.IBlock | undefined)}
     * @memberof ForgerService
     */
    private lastForgedBlock: Interfaces.IBlock | undefined;

    /**
     * @private
     * @type {(Interfaces.ITransactionData[])}
     * @memberof ForgerService
     */
    private transactions;

    /**
     * @private
     * @type {boolean}
     * @memberof ForgerService
     */
    private initialized: boolean = false;

    /**
     * @private
     * @type {boolean}
     * @memberof ForgerService
     */
    private logAppReady: boolean = true;

    public getRound(): Contracts.P2P.CurrentRound | undefined {
        return this.round;
    }

    public getRemainingSlotTime(): number | undefined {
        return this.round ? this.getRoundRemainingSlotTime(this.round) : undefined;
    }

    public getLastForgedBlock(): Interfaces.IBlock | undefined {
        return this.lastForgedBlock;
    }

    /**
     * @param {*} options
     * @memberof ForgerService
     */
    public register(hosts: RelayHost[]): void {
        this.client = this.app.resolve<Client>(Client);
        this.client.register(hosts);
    }

    /**
     * @param {Delegate[]} delegates
     * @returns {Promise<void>}
     * @memberof ForgerService
     */
    public async boot(delegates: Delegate[]): Promise<void> {
        if (this.handlerProvider.isRegistrationRequired()) {
            this.handlerProvider.registerHandlers();
        }

        this.delegates = delegates.filter((value, index, self) => {
            return index === self.findIndex((delegate) => delegate.publicKey === value.publicKey);
        });

        let timeout: number = 2000;
        try {
            await this.loadRound();
            AppUtils.assert.defined<Contracts.P2P.CurrentRound>(this.round);
            timeout = 0;
        } catch (error) {
            this.logger.warning("Waiting for a responsive host :hourglass_flowing_sand:");
        } finally {
            this.checkLater(timeout);
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof ForgerService
     */
    public async dispose(): Promise<void> {
        this.isStopped = true;

        this.client.dispose();
    }

    /**
     * todo: make this private
     *
     * @returns {Promise<void>}
     * @memberof ForgerService
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

            AppUtils.assert.defined<string>(this.round.currentForger.publicKey);

            const delegate: Delegate | undefined = this.isActiveDelegate(this.round.currentForger.publicKey);

            if (!delegate) {
                AppUtils.assert.defined<string>(this.round.nextForger.publicKey);

                if (this.isActiveDelegate(this.round.nextForger.publicKey)) {
                    const blocktime = Managers.configManager.getMilestone(this.round.lastBlock.height).blocktime;
                    const username = this.usernames[this.round.nextForger.publicKey];

                    this.logger.info(
                        `Delegate ${username} is due to forge in ${AppUtils.pluralize(
                            "second",
                            blocktime,
                            true,
                        )} from now :sparkles:`,
                    );

                    await this.client.syncWithNetwork();
                }

                return this.checkLater(this.getRoundRemainingSlotTime(this.round));
            }

            this.errorCount = 0;

            await this.app
                .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
                .call("forgeNewBlock", { forgerService: this, delegate, firstAttempt: true, round: this.round });

            this.logAppReady = true;

            return this.checkLater(this.getRoundRemainingSlotTime(this.round));
        } catch (error) {
            if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                if (error.message.includes("blockchain isn't ready") || error.message.includes("App is not ready")) {
                    if (this.logAppReady) {
                        this.logger.info("Waiting for relay to become ready :hourglass_flowing_sand:");
                        this.logAppReady = false;
                    }
                } else {
                    this.logger.warning(error.message);
                }
            } else {
                try {
                    this.client.emitEvent(Enums.ForgerEvent.Failed, { error: error.message });
                } catch {
                    //
                }
            }

            // no idea when this will be ok, so waiting 2s before checking again
            return this.checkLater(2000);
        }
    }

    /**
     * @param {Delegate} delegate
     * @param {Contracts.P2P.CurrentRound} round
     * @param {Contracts.P2P.NetworkState} networkState
     * @returns {Promise<void>}
     * @memberof ForgerService
     */
    public async forgeNewBlock(
        delegate: Delegate,
        firstAttempt: boolean,
        round: Contracts.P2P.CurrentRound,
    ): Promise<void> {
        setImmediate(async () => {
            let errored = false;
            const minimumMs = 2000;
            try {
                const networkState: Contracts.P2P.NetworkState = await this.client.getNetworkState(firstAttempt);
                const networkStateHeight = networkState.getNodeHeight();

                AppUtils.assert.defined<number>(networkStateHeight);
                AppUtils.assert.defined<string>(delegate.publicKey);

                Managers.configManager.setHeight(networkStateHeight);

                const roundSlot: number = await this.client.getSlotNumber(round.timestamp);

                if (firstAttempt) {
                    this.transactions = await this.getTransactionsForForging();
                }

                const block: Interfaces.IBlock | undefined = delegate.forge(this.transactions, {
                    previousBlock: {
                        id: networkState.getLastBlockId(),
                        idHex: Managers.configManager.getMilestone().block.idFullSha256
                            ? networkState.getLastBlockId()
                            : Blocks.Block.toBytesHex(networkState.getLastBlockId()),
                        height: networkStateHeight,
                    },
                    timestamp: round.timestamp,
                    reward: round.reward,
                });

                const timeLeftInMs: number = this.getRoundRemainingSlotTime(round);

                const prettyName = this.usernames[delegate.publicKey];

                const { state } = await this.client.getStatus();
                const currentSlot = await this.client.getSlotNumber();
                const lastBlockSlot = await this.client.getSlotNumber(state.header.timestamp);

                if (lastBlockSlot === currentSlot || delegate.publicKey !== round.currentForger.publicKey) {
                    if (
                        firstAttempt &&
                        ((networkState.getLastGenerator() === delegate.publicKey &&
                            networkState.getLastSlotNumber() === roundSlot) ||
                            (state.header.generatorPublicKey === delegate.publicKey && lastBlockSlot === roundSlot))
                    ) {
                        this.logger.warning(
                            `Not going to forge because delegate ${prettyName} has already forged on another node :octagonal_sign:`,
                        );
                    }
                    return;
                }

                if (networkState.getNodeHeight() !== round.lastBlock.height) {
                    this.logger.warning(
                        `The NetworkState height (${networkState
                            .getNodeHeight()
                            ?.toLocaleString()}) and round height (${round.lastBlock.height.toLocaleString()}) are out of sync. This indicates delayed blocks on the network :zzz:`,
                    );
                }

                if (this.isForgingAllowed(networkState, delegate)) {
                    if (
                        timeLeftInMs >= minimumMs &&
                        currentSlot === roundSlot &&
                        delegate.publicKey === round.currentForger.publicKey
                    ) {
                        AppUtils.assert.defined<Interfaces.IBlock>(block);
                        if ((await this.client.getSlotNumber(block.data.timestamp)) !== lastBlockSlot) {
                            this.logger.info(
                                `Delegate ${prettyName} forged a new block at height ${block.data.height.toLocaleString()} with ${AppUtils.pluralize(
                                    "transaction",
                                    block.data.numberOfTransactions,
                                    true,
                                )} :trident:`,
                            );

                            await this.client.broadcastBlock(block);

                            this.lastForgedBlock = block;
                            this.client.emitEvent(Enums.BlockEvent.Forged, block.data);

                            for (const transaction of this.transactions) {
                                this.client.emitEvent(Enums.TransactionEvent.Forged, transaction);
                            }
                        }
                    } else if (timeLeftInMs > 0) {
                        this.logger.warning(
                            `Failed to forge new block by delegate ${prettyName}, because there were ${timeLeftInMs}ms left in the current slot (less than ${minimumMs}ms) :bangbang:`,
                        );
                    } else {
                        this.logger.warning(
                            `Failed to forge new block by delegate ${prettyName}, because already in next slot :bangbang:`,
                        );
                    }
                }
            } catch (error) {
                if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                    this.logger.warning(error.message);
                }
                errored = true;
            }
            await delay(1000);

            try {
                await this.loadRound();
            } catch (error) {
                if (error instanceof HostNoResponseError || error instanceof RelayCommunicationError) {
                    this.logger.warning(error.message);
                }
                errored = true;
            }
            if (errored) {
                this.errorCount++;
            } else {
                this.errorCount = 0;
            }

            const blocktime = Managers.configManager.getMilestone(round.lastBlock.height).blocktime;
            if (this.errorCount < blocktime - 1) {
                return this.forgeNewBlock(delegate, false, this.round!);
            }
        });
    }

    /**
     * @returns {Promise<Interfaces.ITransactionData[]>}
     * @memberof ForgerService
     */
    public async getTransactionsForForging(): Promise<Interfaces.ITransactionData[]> {
        const response = await this.client.getTransactions();
        if (AppUtils.isEmpty(response)) {
            this.logger.warning("Could not get unconfirmed transactions from transaction pool :warning:");
            return [];
        }
        const transactions = response.transactions.map(
            (hex) => Transactions.TransactionFactory.fromBytesUnsafe(Buffer.from(hex, "hex")).data,
        );
        this.logger.debug(
            `Received ${AppUtils.pluralize("transaction", transactions.length, true)} ` +
                `from the pool containing ${AppUtils.pluralize(
                    "transaction",
                    response.poolSize,
                    true,
                )} total :money_with_wings:`,
        );
        return transactions;
    }

    /**
     * @param {Contracts.P2P.NetworkState} networkState
     * @param {Delegate} delegate
     * @returns {boolean}
     * @memberof ForgerService
     */
    public isForgingAllowed(networkState: Contracts.P2P.NetworkState, delegate: Delegate): boolean {
        if (networkState.status === NetworkStateStatus.Unknown) {
            this.logger.info("Failed to get network state from client. Will not forge :bomb:");
            return false;
        } else if (networkState.status === NetworkStateStatus.ColdStart) {
            this.logger.info("Skipping slot because of cold start. Will not forge :bomb:");
            return false;
        } else if (networkState.status === NetworkStateStatus.BelowMinimumDelegates) {
            this.logger.info("Not peered with enough delegates to get quorum. Will not forge :bomb:");
            return false;
        } else if (networkState.status === NetworkStateStatus.BelowMinimumPeers) {
            this.logger.info("Network reach is not sufficient to get quorum. Will not forge :bomb:");
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
                `Detected ${AppUtils.pluralize(
                    "distinct overheight block header",
                    distinctOverHeightBlockHeaders.length,
                    true,
                )} :zzz:`,
            );

            for (const overHeightBlockHeader of overHeightBlockHeaders) {
                if (overHeightBlockHeader.generatorPublicKey === delegate.publicKey) {
                    AppUtils.assert.defined<string>(delegate.publicKey);

                    try {
                        const { verified } = Blocks.BlockFactory.fromData(
                            overHeightBlockHeader as Interfaces.IBlockData,
                        )!.verification;
                        if (verified) {
                            this.logger.warning(
                                `Delegate ${
                                    this.usernames[delegate.publicKey]
                                } already forged a block. Will not forge :bomb:`,
                            );
                            return false;
                        }
                    } catch {
                        //
                    }
                }
            }
        }

        if (!networkState.canForge()) {
            networkState.setOverHeightBlockHeaders(distinctOverHeightBlockHeaders);

            this.logger.info("Not enough quorum to forge next block. Will not forge :bomb:");
            this.logger.debug(`Network State: ${networkState.toJson()}`);

            return false;
        }

        return true;
    }

    /**
     * @private
     * @param {string} publicKey
     * @returns {(Delegate | undefined)}
     * @memberof ForgerService
     */
    private isActiveDelegate(publicKey: string): Delegate | undefined {
        return this.delegates.find((delegate) => delegate.publicKey === publicKey);
    }

    /**
     * @private
     * @returns {Promise<void>}
     * @memberof ForgerService
     */
    private async loadRound(): Promise<void> {
        this.round = await this.client.getRound();

        this.allUsernames = this.round.allDelegates.reduce((acc, wallet) => {
            AppUtils.assert.defined<string>(wallet.publicKey);

            return Object.assign(acc, {
                [wallet.publicKey]: wallet.delegate.username,
            });
        }, {});

        this.usernames = this.round.delegates.reduce((acc, wallet) => {
            AppUtils.assert.defined<string>(wallet.publicKey);

            return Object.assign(acc, {
                [wallet.publicKey]: wallet.delegate.username,
            });
        }, {});

        const oldActiveDelegates: Delegate[] = this.activeDelegates;
        const oldInactiveDelegates: Delegate[] = this.inactiveDelegates;

        this.activeDelegates = this.delegates.filter((delegate) => {
            AppUtils.assert.defined<string>(delegate.publicKey);

            return this.usernames.hasOwnProperty(delegate.publicKey);
        });

        this.inactiveDelegates = this.delegates.filter((delegate) => {
            AppUtils.assert.defined<string>(delegate.publicKey);

            return !this.activeDelegates.includes(delegate);
        });

        if (!this.initialized) {
            AppUtils.sendForgerSignal("SIGTERM");

            const jsonFile: string = `${process.env.CORE_PATH_TEMP}/forger.json`;
            try {
                writeJSONSync(jsonFile, {
                    pid: process.pid,
                    publicKeys: this.delegates.map((delegate) => delegate.publicKey),
                });
            } catch {
                this.app.terminate(`Could not save forger data to ${jsonFile}`);
            }

            this.printLoadedDelegates();

            // @ts-ignore
            this.client.emitEvent(Enums.ForgerEvent.Started, {
                activeDelegates: this.delegates.map((delegate) => delegate.publicKey),
            });

            this.logger.info(`Forger Manager started :hammer:`);
        } else {
            const newlyActiveDelegates = this.activeDelegates
                .map((delegate) => delegate.publicKey)
                .filter(
                    (activeDelegate) =>
                        !oldActiveDelegates.map((oldDelegate) => oldDelegate.publicKey).includes(activeDelegate),
                )
                .map((publicKey) => this.usernames[publicKey]);
            const newlyInactiveDelegates = this.inactiveDelegates
                .map((delegate) => delegate.publicKey)
                .filter(
                    (inactiveDelegate) =>
                        !oldInactiveDelegates.map((oldDelegate) => oldDelegate.publicKey).includes(inactiveDelegate),
                )
                .map((publicKey) => (this.allUsernames[publicKey] ? this.allUsernames[publicKey] : publicKey));

            if (newlyActiveDelegates.length === 1) {
                this.logger.info(`Delegate ${newlyActiveDelegates[0]} is now in an active forging position :tada:`);
            } else if (newlyActiveDelegates.length > 1) {
                this.logger.info(
                    `Delegates ${newlyActiveDelegates
                        .join(", ")
                        .replace(/,(?=[^,]*$)/, " and")} are now in active forging positions :tada:`,
                );
            }

            if (newlyInactiveDelegates.length === 1) {
                this.logger.info(
                    `Delegate ${newlyInactiveDelegates[0]} is no longer in an active forging position :cry:`,
                );
            } else if (newlyInactiveDelegates.length > 1) {
                this.logger.info(
                    `Delegates ${newlyInactiveDelegates
                        .join(", ")
                        .replace(/,(?=[^,]*$)/, " and")} are no longer in active forging positions :cry:`,
                );
            }
        }

        this.initialized = true;
    }

    /**
     * @private
     * @param {number} timeout
     * @memberof ForgerService
     */
    private checkLater(timeout: number): void {
        setTimeout(() => this.checkSlot(), timeout);
    }

    /**
     * @private
     * @memberof ForgerService
     */
    private printLoadedDelegates(): void {
        if (this.activeDelegates.length > 0) {
            this.logger.info(
                `Loaded ${AppUtils.pluralize(
                    "active delegate",
                    this.activeDelegates.length,
                    true,
                )}: ${this.activeDelegates
                    .map(({ publicKey }) => {
                        AppUtils.assert.defined<string>(publicKey);

                        return `${this.usernames[publicKey]}`;
                    })
                    .join(", ")}`,
            );
        }

        if (this.delegates.length > this.activeDelegates.length) {
            this.logger.info(
                `Loaded ${AppUtils.pluralize(
                    "inactive delegate",
                    this.inactiveDelegates.length,
                    true,
                )}: ${this.inactiveDelegates
                    .map(({ publicKey }) => {
                        AppUtils.assert.defined<string>(publicKey);

                        return `${
                            this.allUsernames[publicKey]
                                ? this.allUsernames[publicKey]
                                : `unregistered delegate (public key: ${publicKey})`
                        }`;
                    })
                    .join(", ")}`,
            );
        }
    }

    private getRoundRemainingSlotTime(round: Contracts.P2P.CurrentRound): number {
        const epoch = new Date(Managers.configManager.getMilestone(1).epoch).getTime();
        const blocktime = Managers.configManager.getMilestone(round.lastBlock.height).blocktime;

        return epoch + round.timestamp * 1000 + blocktime * 1000 - Date.now();
    }
}

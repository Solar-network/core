import { Crypto, Managers, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import delay from "delay";

import { Action } from "../contracts";

@Container.injectable()
export class CheckLater implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly peerNetworkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.PoolProcessor)
    private readonly processor!: Contracts.Pool.Processor;

    public async handle(): Promise<void> {
        const { blockTime } = Managers.configManager.getMilestone();
        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(this.app, 1);

        const epoch = Math.floor(new Date(Managers.configManager.getMilestone().epoch).getTime() / 1000);

        let timeNow = Math.floor(Date.now() / 1000);
        while (timeNow < epoch) {
            await delay(Crypto.Slots.getTimeInMsUntilNextSlot(blockTimeLookup));
            timeNow = Math.floor(Date.now() / 1000);
            if (timeNow < epoch) {
                const seconds = epoch - timeNow;

                const emojiSet = {
                    normal: [":hatching_chick:", ":stopwatch:", ":watch:", ":alarm_clock:", ":mantelpiece_clock:"],
                    soon: [":balloon:", ":clinking_glasses:", ":confetti_ball:", ":rocket:", ":partying_face:"],
                };

                const days = Math.floor(seconds / (3600 * 24));
                const hours = Math.floor((seconds % (3600 * 24)) / 3600);

                let emoji = emojiSet.normal;
                if (days === 0 && hours === 0) {
                    emoji = emojiSet.soon;
                }

                const countdown = AppUtils.formatSeconds(seconds);

                this.logger.info(`The network launches in ${countdown} ${emoji[seconds % 5]}`);
            } else {
                this.logger.info(
                    `The network has launched and the next block is due in ${AppUtils.pluralise(
                        "second",
                        blockTime,
                        true,
                    )}! Welcome aboard :tada:`,
                );
            }
        }

        if (!this.blockchain.isStopped() && !this.stateStore.isWakeUpTimeoutSet()) {
            if (!this.stateStore.hasPolledForBlocks()) {
                this.stateStore.polledForBlocks();
                this.peerNetworkMonitor.cleansePeers({
                    fast: true,
                    forcePing: true,
                    log: false,
                    skipCommonBlocks: true,
                });
                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle" || !this.blockchain.isSynced()) {
                        return;
                    }
                    try {
                        let lastBlock = this.app
                            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                            .getLastBlock();
                        let blocks = await this.peerNetworkMonitor.downloadBlocksFromHeight(
                            lastBlock.data.height,
                            undefined,
                            true,
                            2000,
                            true,
                        );
                        lastBlock = this.app
                            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                            .getLastBlock();
                        blocks = blocks.filter((block) => block.height > lastBlock.data.height);
                        if (blocks.length) {
                            if (blocks.length === 1) {
                                this.blockchain.setBlockUsername(blocks[0]);
                                const { height, numberOfTransactions, id, ip, reward, username } = blocks[0];

                                if (!username || !this.walletRepository.hasByUsername(username)) {
                                    return;
                                }

                                const generatorWallet: Contracts.State.Wallet =
                                    this.walletRepository.findByUsername(username);

                                if (!generatorWallet.hasAttribute("delegate.rank")) {
                                    return;
                                }

                                const rank = generatorWallet.getAttribute("delegate.rank");
                                const generator: string = `delegate ${username} (#${rank})`;

                                this.logger.info(
                                    `Downloaded new block forged by ${generator} at height ${height.toLocaleString()} with ${Utils.formatSatoshi(
                                        reward,
                                    )} reward :package:`,
                                );

                                const { dynamicReward } = Managers.configManager.getMilestone();

                                if (
                                    dynamicReward &&
                                    dynamicReward.enabled &&
                                    reward.isEqualTo(dynamicReward.secondaryReward)
                                ) {
                                    const { alreadyForged } = await this.roundState.getRewardForBlockInRound(
                                        height,
                                        generatorWallet,
                                    );
                                    if (alreadyForged && !reward.isEqualTo(dynamicReward.ranks[rank])) {
                                        this.logger.info(
                                            `The reward was reduced because ${username} already forged in this round :fire:`,
                                        );
                                    }
                                }

                                this.logger.debug(`The id of the new block is ${id}`);

                                this.logger.debug(
                                    `It contains ${AppUtils.pluralise(
                                        "transaction",
                                        numberOfTransactions,
                                        true,
                                    )} and was downloaded from ${ip}`,
                                );

                                this.blockchain.handleIncomingBlock(blocks[0], false, ip!, false);
                            } else {
                                this.blockchain.enqueueBlocks(blocks);
                            }
                        }
                    } catch {
                        //
                    }
                }, 500);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle" || !this.blockchain.isSynced()) {
                        return;
                    }

                    const exclude: string[] = Array.from(this.poolQuery.getFromHighestPriority()).map((t) => t.id!);
                    const transactions: Buffer[] = await this.peerNetworkMonitor.downloadTransactions(exclude);
                    if (transactions.length > 0) {
                        await this.processor.process(transactions);
                    }
                }, 4000);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle" || !this.blockchain.isSynced()) {
                        return;
                    }

                    if (!this.peerNetworkMonitor.hasMinimumPeers(true)) {
                        await this.peerNetworkMonitor.populateSeedPeers();
                    }
                }, 1000);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle" || !this.blockchain.isSynced()) {
                        return;
                    }

                    if (await this.peerNetworkMonitor.discoverPeers(false, true, true)) {
                        await this.peerNetworkMonitor.cleansePeers({ log: false });
                    }
                }, 30000);
            }

            this.blockchain.setWakeUp();
        }
    }
}

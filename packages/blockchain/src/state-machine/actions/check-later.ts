import { Managers, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class CheckLater implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "blockchain")
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
        if (!this.blockchain.isStopped() && !this.stateStore.isWakeUpTimeoutSet()) {
            if (!this.stateStore.hasPolledForBlocks()) {
                this.stateStore.polledForBlocks();
                this.peerNetworkMonitor.cleansePeers({
                    fast: true,
                    forcePing: true,
                    log: false,
                    skipCommonBlocks: true,
                });
                let lastBlockId: string | undefined;

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle") {
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
                        if (this.stateStore.getBlockchain().value !== "idle") {
                            return;
                        }
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

                                if (!generatorWallet.hasAttribute("blockProducer.rank")) {
                                    return;
                                }

                                if (lastBlockId !== `${id},${lastBlock.data.id}`) {
                                    const rank = generatorWallet.getAttribute("blockProducer.rank");
                                    const generator: string = `${username} (#${rank})`;

                                    this.logger.info(
                                        `Downloaded new block by ${generator} at height ${height.toLocaleString()} with ${Utils.formatSatoshi(
                                            reward,
                                        )} reward`,
                                        "📥",
                                    );

                                    const { dynamicReward } = Managers.configManager.getMilestone();

                                    if (
                                        dynamicReward &&
                                        dynamicReward.enabled &&
                                        reward.isEqualTo(dynamicReward.secondaryReward)
                                    ) {
                                        const { alreadyProducedBlock } = await this.roundState.getRewardForBlockInRound(
                                            height,
                                            generatorWallet,
                                        );
                                        if (alreadyProducedBlock && !reward.isEqualTo(dynamicReward.ranks[rank])) {
                                            this.logger.info(
                                                `The reward was reduced because ${username} already produced a block in this round`,
                                                "🪙",
                                            );
                                        }
                                    }

                                    this.logger.trace(`The id of the new block is ${id}`, "🏷️");

                                    this.logger.debug(
                                        `It contains ${AppUtils.pluralise(
                                            "transaction",
                                            numberOfTransactions,
                                            true,
                                        )} and was downloaded from ${ip}`,
                                        numberOfTransactions === 0 ? "🪹" : "🪺",
                                    );

                                    this.blockchain.handleIncomingBlock(blocks[0], false, ip!, false);
                                    lastBlockId = `${id},${lastBlock.data.id}`;
                                }
                            } else {
                                this.blockchain.dispatch("NEWBLOCK");
                                this.blockchain.enqueueBlocks(blocks);
                            }
                        }
                    } catch {
                        //
                    }
                }, 500);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle") {
                        return;
                    }

                    const exclude: string[] = Array.from(this.poolQuery.getFromHighestPriority()).map((t) => t.id!);
                    const transactions: Buffer[] = await this.peerNetworkMonitor.downloadTransactions(exclude);
                    if (transactions.length > 0) {
                        await this.processor.process(transactions);
                    }
                }, 4000);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle") {
                        return;
                    }

                    if (!this.peerNetworkMonitor.hasMinimumPeers(true)) {
                        await this.peerNetworkMonitor.populateSeedPeers();
                    }
                }, 1000);

                setInterval(async () => {
                    if (this.stateStore.getBlockchain().value !== "idle") {
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

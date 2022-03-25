import { Container, Contracts, Enums, Utils as AppUtils } from "@solar-network/core-kernel";
import { Crypto, Managers, Utils } from "@solar-network/crypto";
import delay from "delay";

import { Action } from "../contracts";

@Container.injectable()
export class CheckLater implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly peerNetworkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async handle(): Promise<void> {
        const { blocktime } = await Managers.configManager.getMilestone();
        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(this.app, 1);

        const epoch = Math.floor(new Date(Managers.configManager.getMilestone().epoch).getTime() / 1000);

        let timeNow = Math.floor(new Date().getTime() / 1000);
        while (timeNow < epoch) {
            await delay(Crypto.Slots.getTimeInMsUntilNextSlot(blockTimeLookup));
            timeNow = Math.floor(new Date().getTime() / 1000);
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
                    `The network has launched and the next block is due in ${AppUtils.pluralize(
                        "second",
                        blocktime,
                        true,
                    )}! Welcome aboard :tada:`,
                );
            }
        }

        if (!this.blockchain.isStopped() && !this.stateStore.isWakeUpTimeoutSet()) {
            if (!this.stateStore.hasPolledForBlocks()) {
                this.stateStore.polledForBlocks();
                this.peerNetworkMonitor.cleansePeers({ fast: true, forcePing: true, log: false });
                const downloadInterval = setInterval(async () => {
                    try {
                        let lastBlock = this.app
                            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                            .getLastBlock();
                        let blocks = await this.peerNetworkMonitor.downloadBlocksFromHeight(
                            lastBlock.data.height,
                            undefined,
                            true,
                            2000,
                        );
                        lastBlock = this.app
                            .get<Contracts.State.StateStore>(Container.Identifiers.StateStore)
                            .getLastBlock();
                        blocks = blocks.filter((block) => block.height > lastBlock.data.height);
                        if (blocks.length) {
                            if (blocks.length === 1) {
                                const generatorWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
                                    blocks[0].generatorPublicKey,
                                );

                                let generator: string;
                                try {
                                    generator = `delegate ${generatorWallet.getAttribute(
                                        "delegate.username",
                                    )} (#${generatorWallet.getAttribute("delegate.rank")})`;
                                } catch {
                                    generator = "an unknown delegate";
                                }

                                this.logger.info(
                                    `Downloaded new block forged by ${generator} at height ${blocks[0].height.toLocaleString()} with ${Utils.formatSatoshi(
                                        blocks[0].reward,
                                    )} reward :package:`,
                                );

                                this.logger.debug(`The id of the new block is ${blocks[0].id}`);

                                this.logger.debug(
                                    `It contains ${AppUtils.pluralize(
                                        "transaction",
                                        blocks[0].numberOfTransactions,
                                        true,
                                    )} and was downloaded from ${blocks[0].ip}`,
                                );

                                this.blockchain.handleIncomingBlock(blocks[0], false, false);
                            } else {
                                this.blockchain.enqueueBlocks(blocks);
                                this.blockchain.dispatch("DOWNLOADED");
                            }
                        }
                    } catch {
                        //
                    }
                }, 500);

                const stopDownloading = {
                    handle: () => {
                        this.events.forget(Enums.BlockEvent.Received, stopDownloading);
                        clearInterval(downloadInterval);
                    },
                };

                this.events.listen(Enums.BlockEvent.Received, stopDownloading);
            }

            this.blockchain.setWakeUp();
        }
    }
}

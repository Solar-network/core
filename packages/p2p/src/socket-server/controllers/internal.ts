import Hapi from "@hapi/hapi";
import { Crypto, Managers } from "@solar-network/crypto";
import { Container, Contracts, Services, Utils } from "@solar-network/kernel";

import { Controller } from "./controller";

export class InternalController extends Controller {
    @Container.inject(Container.Identifiers.PeerNetworkMonitor)
    private readonly peerNetworkMonitor!: Contracts.P2P.NetworkMonitor;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    public emitEvent(request: Hapi.Request, h: Hapi.ResponseToolkit): boolean {
        this.events.dispatch((request.payload as any).event, (request.payload as any).body);
        return true;
    }

    public async getCurrentRound(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.P2P.CurrentRound> {
        const lastBlock = this.blockchain.getLastBlock();

        const height = lastBlock.data.height + 1;
        const roundInfo = Utils.roundCalculator.calculateRound(height);

        const allBlockProducers: Contracts.P2P.BlockProducerWallet[] = this.walletRepository
            .allBlockProducers()
            .map((wallet: Contracts.State.Wallet) => ({
                ...wallet.getData(),
                blockProducer: wallet.getAttribute("blockProducer"),
                username: wallet.getAttribute("username"),
            }));

        const blockProducers: Contracts.P2P.BlockProducerWallet[] = (
            (await this.triggers.call("getActiveBlockProducers", {
                roundInfo,
            })) as Contracts.State.Wallet[]
        ).map((wallet) => ({
            ...wallet.getData(),
            blockProducer: wallet.getAttribute("blockProducer"),
            username: wallet.getAttribute("username"),
        }));

        const blockTimeLookup = await Utils.blockProductionInfoCalculator.getBlockTimeLookup(this.app, height);

        const timestamp: number = Crypto.Slots.getTime();
        const blockProductionInfo = Utils.blockProductionInfoCalculator.calculateBlockProductionInfo(
            timestamp,
            height,
            blockTimeLookup,
        );

        const { reward } =
            blockProducers[blockProductionInfo.currentBlockProducer] &&
            this.walletRepository.hasByUsername(blockProducers[blockProductionInfo.currentBlockProducer].username)
                ? await this.roundState.getRewardForBlockInRound(
                      height,
                      this.walletRepository.findByUsername(
                          blockProducers[blockProductionInfo.currentBlockProducer].username,
                      ),
                  )
                : Managers.configManager.getMilestone();

        return {
            allBlockProducers,
            canProduceBlock: blockProductionInfo.canProduceBlock,
            current: roundInfo.round,
            currentBlockProducer: blockProducers[blockProductionInfo.currentBlockProducer],
            blockProducers,
            lastBlock: lastBlock.data,
            nextBlockProducer: blockProducers[blockProductionInfo.nextBlockProducer],
            reward: reward.toString(),
            timestamp: blockProductionInfo.blockTimestamp,
        };
    }

    public async getSlotNumber(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<number> {
        const lastBlock = this.blockchain.getLastBlock();

        const height = lastBlock.data.height + 1;
        const blockTimeLookup = await Utils.blockProductionInfoCalculator.getBlockTimeLookup(this.app, height);
        return Crypto.Slots.getSlotNumber(blockTimeLookup, (request.payload as { timestamp: number }).timestamp);
    }

    public async getNetworkState(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.P2P.NetworkState> {
        return await this.peerNetworkMonitor.getNetworkState(!!(request.payload as { log: boolean }).log);
    }

    public syncBlockchain(request: Hapi.Request, h: Hapi.ResponseToolkit): boolean {
        this.logger.debug("Blockchain sync check WAKEUP requested by block producer module", "🛏️");

        this.blockchain.forceWakeup();

        return true;
    }
}

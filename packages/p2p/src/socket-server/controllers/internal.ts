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

        const allDelegates: Contracts.P2P.DelegateWallet[] = (await this.walletRepository.allByUsername()).map(
            (wallet) => ({
                ...wallet.getData(),
                delegate: wallet.getAttribute("delegate"),
            }),
        );

        const delegates: Contracts.P2P.DelegateWallet[] = (
            (await this.triggers.call("getActiveDelegates", {
                roundInfo,
            })) as Contracts.State.Wallet[]
        ).map((wallet) => ({
            ...wallet.getData(),
            delegate: wallet.getAttribute("delegate"),
        }));

        const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(this.app, height);

        const timestamp: number = Crypto.Slots.getTime();
        const forgingInfo = Utils.forgingInfoCalculator.calculateForgingInfo(timestamp, height, blockTimeLookup);

        const { reward } =
            delegates[forgingInfo.currentForger] &&
            this.walletRepository.hasByUsername(delegates[forgingInfo.currentForger].delegate.username)
                ? await this.roundState.getRewardForBlockInRound(
                      height,
                      this.walletRepository.findByUsername(delegates[forgingInfo.currentForger].delegate.username),
                  )
                : Managers.configManager.getMilestone();

        return {
            allDelegates,
            canForge: forgingInfo.canForge,
            current: roundInfo.round,
            currentForger: delegates[forgingInfo.currentForger],
            delegates,
            lastBlock: lastBlock.data,
            nextForger: delegates[forgingInfo.nextForger],
            reward: reward.toString(),
            timestamp: forgingInfo.blockTimestamp,
        };
    }

    public async getSlotNumber(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<number> {
        const lastBlock = this.blockchain.getLastBlock();

        const height = lastBlock.data.height + 1;
        const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(this.app, height);
        return Crypto.Slots.getSlotNumber(blockTimeLookup, (request.payload as { timestamp: number }).timestamp);
    }

    public async getNetworkState(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.P2P.NetworkState> {
        return await this.peerNetworkMonitor.getNetworkState(!!(request.payload as { log: boolean }).log);
    }

    public syncBlockchain(request: Hapi.Request, h: Hapi.ResponseToolkit): boolean {
        this.logger.debug("Blockchain sync check WAKEUP requested by forger", "🛏️");

        this.blockchain.forceWakeup();

        return true;
    }
}

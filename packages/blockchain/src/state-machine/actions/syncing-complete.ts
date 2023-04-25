import { Container, Contracts, Enums, Utils as AppUtils } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class SyncingComplete implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async handle(): Promise<void> {
        this.logger.info("Blockchain 100% in sync :100:");

        const roundInfo: Contracts.Shared.RoundInfo = AppUtils.roundCalculator.calculateRound(
            this.blockchain.getLastHeight(),
        );
        const ourKeys: string[] = AppUtils.getForgerDelegates();

        for (const wallet of this.walletRepository.allByUsername()) {
            if (wallet.hasPublicKey() && ourKeys.includes(wallet.getPublicKey()!)) {
                wallet.setAttribute("delegate.version", { round: roundInfo.round, version: this.app.version() });
            } else if (wallet.hasAttribute("delegate.version")) {
                const { round } = wallet.getAttribute("delegate.version");
                if (!round || round < roundInfo.round - 5) {
                    wallet.forgetAttribute("delegate.version");
                }
            }
        }

        this.events.dispatch(Enums.BlockchainEvent.Synced);
        this.blockchain.dispatch("SYNCFINISHED");
    }
}
